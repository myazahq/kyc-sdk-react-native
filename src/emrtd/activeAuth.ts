import { toBase64 } from './bytes';
import { EF, type Transceive } from './files';
import { readOptionalFile } from './optionalRead';
import type { SecureMessagingSession } from './secureMessaging';

// ---------------------------------------------------------------------------
// ACTIVE AUTHENTICATION — asking the chip to prove it is not a copy.
//
// Passive authentication (the SOD) proves the data was signed by the issuing
// state. It cannot prove this is the chip they signed it onto: copy a genuine
// passport's files onto a blank chip and every hash and signature still
// verifies, because none of them is bound to the silicon.
//
// So we ask the chip to SIGN something. Its private key never leaves it, and
// the matching public key sits in DG15 — which is itself hashed into the SOD,
// so the issuing state has vouched for it. A cloner can copy DG15; they cannot
// copy the key that answers for it.
//
// TWO THINGS MATTER HERE, and neither is visible from this file alone:
//
//   • THE CHALLENGE IS THE SERVER'S. We do not generate it. A nonce we chose
//     would let anyone replay one captured (challenge, signature) pair forever,
//     which is the clone this is meant to catch.
//   • WE DO NOT VERIFY. The signature is carried to the server untouched and
//     checked there against a SOD-bound DG15. A client that verified its own
//     chip would be a client an attacker can simply patch — the same reason
//     passive authentication has always run server-side.
//
// Both are also why this file is short: reading and forwarding is the whole job.
// ---------------------------------------------------------------------------

/** ICAO 9303-11 fixes the Active-Authentication challenge at 8 bytes. */
export const AA_CHALLENGE_BYTES = 8;

/** The server's challenge: its id (to spend) and its bytes (for the chip). */
export interface AaChallenge {
  id: string;
  bytes: Uint8Array;
}

export interface ActiveAuthRead {
  /** Base64 DG15 — the chip's AA public key. Absent ⇒ the chip has no AA. */
  dg15?: string;
  /** Base64 signature over the challenge. Absent ⇒ the chip would not sign. */
  signature?: string;
}

/**
 * INTERNAL AUTHENTICATE — hand the chip the challenge, take back its signature.
 *
 * Le is 0 (meaning "as much as you have"): the answer is one RSA modulus or one
 * raw r||s pair, and the length varies by document. Naming a length would work
 * on the passports we happened to test and truncate the rest.
 */
async function internalAuthenticate(
  sm: SecureMessagingSession,
  transceive: Transceive,
  challenge: Uint8Array,
): Promise<Uint8Array | null> {
  try {
    const { data, statusWord } = sm.unprotect(
      await transceive(
        sm.protect({ cla: 0x00, ins: 0x88, p1: 0x00, p2: 0x00, data: challenge, le: 0 }),
      ),
    );
    if (statusWord !== 0x9000 || data.length === 0) return null;
    return data;
  } catch {
    // A chip that carries DG15 but refuses to sign is unusual but not a
    // finding: it costs the anti-clone check, never the read.
    return null;
  }
}

/**
 * Read DG15 and get the chip to sign the server's challenge.
 *
 * Best-effort throughout, like every optional group: most chips in the field
 * support no Active Authentication at all, and reporting that as a problem
 * would flag the majority of genuine passports.
 */
export async function readActiveAuth(
  sm: SecureMessagingSession,
  transceive: Transceive,
  challenge: AaChallenge | undefined,
): Promise<ActiveAuthRead> {
  // No challenge means the server could not issue one. Reading DG15 anyway
  // would cost a round trip on the document for a key nothing can be checked
  // against, so the whole step is skipped.
  if (!challenge || challenge.bytes.length !== AA_CHALLENGE_BYTES) return {};

  const dg15 = await readOptionalFile(sm, transceive, EF.DG15, 'DG15');
  if (!dg15) return {};

  const signature = await internalAuthenticate(sm, transceive, challenge.bytes);
  return {
    dg15: toBase64(dg15),
    ...(signature ? { signature: toBase64(signature) } : {}),
  };
}
