import { fromBase64, toBase64 } from './bytes';
import { buildBacChallenge, completeBac } from './bac';
import { primitivesFromNative, type EmrtdPrimitives, type MrzKeyFields } from './crypto';
import { EF, readFile, type Transceive } from './files';
import { readOptionalFile } from './optionalRead';
import { PaceError, PREFER_PACE, tryPace, type PaceOutcome } from './open';
import { SecureMessagingSession } from './secureMessaging';
import type { NfcReadStage } from './stages';

// ---------------------------------------------------------------------------
// Reading a chip, end to end.
//
// Select the application, run BAC, then read the files. What comes back is
// handed to the SERVER, which is where authenticity is decided: the server
// hashes DG1 against the signed security object and checks the document
// signer's signature. Nothing here may conclude that a chip is genuine — a
// client-side "authentic" flag is a claim an attacker controls.
//
// So the job of this file is narrow and honest: get the bytes off the chip, and
// report clearly when it could not.
// ---------------------------------------------------------------------------

/** The eMRTD application identifier — selected before anything else works. */
const AID = new Uint8Array([0xa0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01]);

const SW_OK = 0x9000;

export class EmrtdSessionError extends Error {
  constructor(
    message: string,
    /** A stable token the UI branches on, rather than matching prose. */
    readonly code: 'select_failed' | 'bac_failed' | 'read_failed' | 'transport',
  ) {
    super(message);
    this.name = 'EmrtdSessionError';
    Object.setPrototypeOf(this, EmrtdSessionError.prototype);
  }
}

/** What a successful read yields, all base64 for the submission. */
export interface EmrtdReadResult {
  /** DG1 — the MRZ as the chip stores it. Always present on success. */
  dg1: string;
  /** EF.SOD — the signed security object. The server needs it to verify DG1. */
  sod?: string;
  /** DG2 — the portrait. Best-effort; the largest file and the likeliest to drop. */
  dg2?: string;
  /** How the chip was unlocked. Reported to the server on the submission. */
  chipAuth: 'bac' | 'pace';
  /**
   * Why the session is on that protocol, and the negotiated variant when PACE
   * ran. Diagnostics only: it never changes the read, and it is what
   * distinguishes "the chip does not speak PACE" from "our PACE failed".
   */
  paceOutcome?: PaceOutcome;
  paceDetail?: string;
}

/** The raw transport, before secure messaging wraps it. */
export interface EmrtdTransport {
  /** Send an APDU, get data + status word back. */
  transceive(apduBase64: string): Promise<{ data: string; statusWord: number }>;
}

/** SELECT the eMRTD application. Nothing else responds until this succeeds. */
async function selectApplication(transport: EmrtdTransport): Promise<void> {
  const apdu = new Uint8Array([0x00, 0xa4, 0x04, 0x0c, AID.length, ...AID]);
  const { statusWord } = await transport.transceive(toBase64(apdu));
  if (statusWord !== SW_OK) {
    throw new EmrtdSessionError(
      `The chip did not accept the passport application (0x${statusWord.toString(16)}).`,
      'select_failed',
    );
  }
}

/** GET CHALLENGE — the chip's 8-byte nonce, which starts BAC. */
async function getChallenge(transport: EmrtdTransport): Promise<Uint8Array> {
  const { data, statusWord } = await transport.transceive(
    toBase64(new Uint8Array([0x00, 0x84, 0x00, 0x00, 0x08])),
  );
  if (statusWord !== SW_OK) {
    throw new EmrtdSessionError(
      `The chip refused to issue a challenge (0x${statusWord.toString(16)}).`,
      'bac_failed',
    );
  }
  return fromBase64(data);
}

/**
 * Run BAC and open a secure-messaging session.
 *
 * A failure here means the MRZ was read wrong, or the thing answering is not
 * the document — NOT that the read should be retried with the same key.
 */
async function openSession(
  p: EmrtdPrimitives,
  transport: EmrtdTransport,
  mrz: MrzKeyFields,
): Promise<SecureMessagingSession> {
  const rndIc = await getChallenge(transport);
  const challenge = buildBacChallenge(p, mrz, rndIc);

  const apdu = new Uint8Array([
    0x00,
    0x82,
    0x00,
    0x00,
    challenge.command.length,
    ...challenge.command,
    0x28,
  ]);
  const { data, statusWord } = await transport.transceive(toBase64(apdu));
  if (statusWord !== SW_OK) {
    throw new EmrtdSessionError(
      'The chip rejected the key derived from the document. Check the scanned details.',
      'bac_failed',
    );
  }

  const { keys, ssc } = completeBac(p, challenge, fromBase64(data));
  return new SecureMessagingSession(p, keys, ssc);
}

/**
 * Read the chip.
 *
 * DG1 is required — without the MRZ there is nothing to verify. EF.SOD and DG2
 * are BEST-EFFORT and in that order: the SOD is what makes DG1 trustworthy, and
 * DG2 is only worth reading if the SOD arrived, since an unverifiable portrait
 * is one an attacker could have substituted.
 */
export async function readChip(
  native: Parameters<typeof primitivesFromNative>[0] & EmrtdTransport,
  mrz: MrzKeyFields,
  /**
   * Progress, so the UI can narrate a read that is otherwise invisible. Each
   * call marks the step ABOUT to run, not the one just finished — the user
   * needs to know what is happening now, and EF.SOD in particular takes long
   * enough that silence reads as failure and prompts them to lift the document.
   */
  onStage?: (stage: NfcReadStage) => void,
): Promise<EmrtdReadResult> {
  const p = primitivesFromNative(native);

  onStage?.('authenticating');
  const access = await establishSession(p, native, mrz);
  const sm = access.sm;

  const transceive: Transceive = async (command) => {
    const { data, statusWord } = await native.transceive(toBase64(command));
    // The wrapped response is what secure messaging verifies; the outer status
    // word is not covered by the MAC and is not the one that counts.
    const body = fromBase64(data);
    const out = new Uint8Array(body.length + 2);
    out.set(body);
    out[body.length] = (statusWord >> 8) & 0xff;
    out[body.length + 1] = statusWord & 0xff;
    return out;
  };

  onStage?.('readingData');
  let dg1: Uint8Array;
  try {
    dg1 = await readFile(sm, transceive, EF.DG1);
  } catch (err) {
    throw new EmrtdSessionError(
      err instanceof Error ? err.message : 'The chip stopped responding.',
      'read_failed',
    );
  }

  // From here on, a failure costs a signal rather than the read. A chip that
  // gave up its MRZ has already proven it holds the BAC key. Optional reads
  // get a second in-session try and NAME their failure — see optionalRead.ts.
  onStage?.('readingSecurity');
  const sod = await readOptionalFile(sm, transceive, EF.SOD, 'EF.SOD');

  let dg2: Uint8Array | null = null;
  if (sod) {
    onStage?.('readingPhoto');
    dg2 = await readOptionalFile(sm, transceive, EF.DG2, 'DG2');
  }
  onStage?.('done');

  return {
    dg1: toBase64(dg1),
    ...(sod ? { sod: toBase64(sod) } : {}),
    ...(dg2 ? { dg2: toBase64(dg2) } : {}),
    chipAuth: access.chipAuth,
    paceOutcome: access.outcome,
    ...(access.detail ? { paceDetail: access.detail } : {}),
  };
}

/**
 * Open a secured session, trying both access protocols as needed.
 *
 * The ordering lives in open.ts (PREFER_PACE) along with why it is what it is.
 * Whichever protocol goes first, the other still runs as the fallback, so a
 * document that read before still reads.
 */
async function establishSession(
  p: EmrtdPrimitives,
  native: EmrtdTransport,
  mrz: MrzKeyFields,
): Promise<{
  sm: SecureMessagingSession;
  chipAuth: 'bac' | 'pace';
  outcome: PaceOutcome;
  detail?: string;
}> {
  // SELECT + BAC are retried ONCE in place, on the same live connection.
  // On Android the tag is routinely dispatched while the platform is still
  // settling the link, so the first exchange dies with the chip right there —
  // and an immediate second attempt succeeds with the phone untouched. The
  // Flutter SDK documents and fixes this exact failure the same way
  // (nfc_reader_emrtd.dart); a full session teardown cannot fix it, because
  // Android never re-dispatches a tag that stayed in the field, so the outer
  // retry loop just waited for a re-tap nobody knew to perform.
  const bac = async (): Promise<SecureMessagingSession> => {
    let sm: SecureMessagingSession | null = null;
    for (let attempt = 0; sm === null; attempt += 1) {
      try {
        await selectApplication(native);
        sm = await openSession(p, native, mrz);
      } catch (err) {
        if (attempt >= 1) throw err;
      }
    }
    return sm;
  };

  // PACE leaves the chip mid-protocol when it fails, so BAC after a failed
  // PACE runs against a chip in an unknown state. Both orders below therefore
  // re-SELECT the application first, which bac() already does.
  const pace = async (): Promise<
    { sm: SecureMessagingSession; detail: string } | { outcome: PaceOutcome; detail?: string }
  > => {
    try {
      return await tryPace(p, native, mrz);
    } catch (err) {
      // A chip that fails PACE may still answer BAC, so this is never fatal
      // by itself — only the reason is kept.
      const detail =
        err instanceof PaceError ? `${err.code}: ${err.message}` : String(err ?? '');
      return { outcome: 'failed', detail };
    }
  };

  if (PREFER_PACE) {
    const attempted = await pace();
    if ('sm' in attempted) {
      // After PACE the application must be selected through the secure channel.
      await selectApplicationSecure(attempted.sm, native);
      return { sm: attempted.sm, chipAuth: 'pace', outcome: 'used', detail: attempted.detail };
    }
    return { sm: await bac(), chipAuth: 'bac', outcome: attempted.outcome, detail: attempted.detail };
  }

  try {
    return { sm: await bac(), chipAuth: 'bac', outcome: 'notAttempted' };
  } catch (bacFailure) {
    // BAC was refused. A chip that has retired it may still open with PACE, and
    // trying costs one exchange against a document that has otherwise failed.
    const attempted = await pace();
    if ('sm' in attempted) {
      await selectApplicationSecure(attempted.sm, native);
      return { sm: attempted.sm, chipAuth: 'pace', outcome: 'used', detail: attempted.detail };
    }
    // Both refused. The BAC failure is the one the user is told about: its
    // message already says the document details did not match.
    throw bacFailure;
  }
}

/**
 * SELECT the eMRTD application through an established PACE channel.
 *
 * PACE authenticates at the Master File, so the application still has to be
 * selected afterwards — and now every command is wrapped, so it goes through
 * secure messaging rather than the raw transport.
 */
async function selectApplicationSecure(
  sm: SecureMessagingSession,
  transport: EmrtdTransport,
): Promise<void> {
  const wrapped = sm.protect({ cla: 0x00, ins: 0xa4, p1: 0x04, p2: 0x0c, data: AID });
  const { data, statusWord } = await transport.transceive(toBase64(wrapped));
  const body = fromBase64(data);
  const framed = new Uint8Array(body.length + 2);
  framed.set(body);
  framed[body.length] = (statusWord >> 8) & 0xff;
  framed[body.length + 1] = statusWord & 0xff;

  const unwrapped = sm.unprotect(framed);
  if (unwrapped.statusWord !== SW_OK) {
    throw new EmrtdSessionError(
      'The secured session did not hold when selecting the passport application.',
      'select_failed',
    );
  }
}
