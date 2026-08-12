import { fromBase64, toBase64 } from './bytes';
import type { EmrtdPrimitives, MrzKeyFields } from './crypto';
import { paceKeySeed } from './crypto';
import { curveForParameterId } from './ec-curves';
import { runPaceEcdhGm, PaceError, type PaceTransceive } from './pace';
import {
  describeProtocol,
  paceGapFor,
  parseCardAccess,
  selectPaceOffer,
} from './pace-params';
import type { SecureMessagingSession } from './secureMessaging';
import type { EmrtdTransport } from './session';

// ---------------------------------------------------------------------------
// Choosing how to get into the chip.
//
// A chip may accept BAC, PACE, or both, and this decides which is tried first.
//
// The standard prefers PACE, and so should we eventually: BAC derives its keys
// from the MRZ alone, so anyone who photographs the passport page can decrypt a
// recorded session afterwards, while PACE agrees fresh keys every time.
//
// But this SDK's BAC has been reading real passports for a long time and its
// PACE has not read any, so the default here is deliberately the other way
// round: BAC first, PACE only when BAC is refused. In that order PACE can only
// ever ADD documents we can read — chips that have retired BAC — and can never
// take away one that already worked.
//
// PACE has since been confirmed against a real document — a Nigerian e-passport
// on 2026-08-11, over PACE-ECDH-GM with AES-256 on brainpoolP256r1, on both an
// iPhone 16 Pro Max and a Galaxy S24, with passive authentication passing and
// the DG2 portrait read. So the code is no longer unproven.
//
// The ordering STAYS BAC-first anyway, which is the part worth explaining:
// "confirmed on one document" is not "confirmed on the population". BAC has
// read every passport this SDK has ever seen; PACE has read one model of one
// issuer's. Going PACE-first would put the less-travelled path in front of
// every document in the world to buy a property (forward secrecy against a
// recorded session) that matters far less than reading the passport at all.
//
// PACE still runs — as the fallback, where it can only ever ADD documents we
// can read, namely chips that have retired BAC. Revisit when PACE has spanned
// several issuers, not before.
//
// Mirrors the Flutter SDK's emrtd_open.dart, including this reasoning.
// ---------------------------------------------------------------------------

/**
 * Which access protocol is tried first.
 *
 * `false` (the shipping default) means BAC first, PACE only if BAC is refused.
 * `true` reverses it, which is how PACE gets exercised against a real chip: a
 * passport that accepts BAC would otherwise never reach the PACE code at all.
 * Set it to `true` temporarily to test PACE against a document; do not ship it.
 *
 * Safe either way — whichever goes first, the other still runs as the fallback,
 * so this cannot turn a readable document into an unreadable one.
 */
export const PREFER_PACE = false;

/**
 * Why a session ended up on the protocol it did.
 *
 * The protocol name alone cannot answer the question that matters while PACE is
 * new: a chip reading over BAC may never have OFFERED PACE, or may have offered
 * it and had our implementation fail. Those call for opposite responses — one
 * is nothing to do, the other is a bug — so the reason is recorded rather than
 * inferred.
 */
export type PaceOutcome =
  /** PACE opened the session. */
  | 'used'
  /** The chip published no EF.CardAccess: it does not speak PACE at all. */
  | 'notOffered'
  /** EF.CardAccess offers only variants this build cannot run. */
  | 'unsupportedVariant'
  /** PACE was attempted and did not complete. THIS is the one worth chasing. */
  | 'failed'
  /** Not tried — BAC succeeded first. */
  | 'notAttempted';

export interface AccessResult {
  sm: SecureMessagingSession;
  /** Which protocol secured the session. */
  chipAuth: 'bac' | 'pace';
  outcome: PaceOutcome;
  /** The negotiated protocol when PACE was used, or why it was not. */
  detail?: string;
}

/** EF.CardAccess: at the Master File, readable with no session at all. */
const EF_CARD_ACCESS = 0x011c;

/**
 * Read EF.CardAccess, or null when the chip does not offer it — which simply
 * means BAC. Absent, unreadable, and unparseable all mean the same thing to
 * the caller, so none of them throw.
 */
export async function readCardAccess(transport: EmrtdTransport): Promise<Uint8Array | null> {
  try {
    // SELECT the Master File, then EF.CardAccess by identifier.
    const mf = await transport.transceive(
      toBase64(new Uint8Array([0x00, 0xa4, 0x00, 0x0c, 0x02, 0x3f, 0x00])),
    );
    if (mf.statusWord !== 0x9000) return null;
    const select = await transport.transceive(
      toBase64(
        new Uint8Array([0x00, 0xa4, 0x02, 0x0c, 0x02, (EF_CARD_ACCESS >> 8) & 0xff, EF_CARD_ACCESS & 0xff]),
      ),
    );
    if (select.statusWord !== 0x9000) return null;
    const read = await transport.transceive(
      toBase64(new Uint8Array([0x00, 0xb0, 0x00, 0x00, 0x00])),
    );
    if (read.statusWord !== 0x9000) return null;
    const data = fromBase64(read.data);
    return data.length > 0 ? data : null;
  } catch {
    return null; // absent or unreadable — the caller falls back to BAC
  }
}

/**
 * Try PACE. Resolves with the session when it worked, or reports why it did
 * not — a `null` result always means "fall back to BAC", never a failed read.
 */
export async function tryPace(
  p: EmrtdPrimitives,
  transport: EmrtdTransport,
  mrz: MrzKeyFields,
): Promise<{ sm: SecureMessagingSession; detail: string } | { outcome: PaceOutcome; detail?: string }> {
  const file = await readCardAccess(transport);
  if (!file) return { outcome: 'notOffered' };

  const offers = parseCardAccess(file);
  const selected = selectPaceOffer(offers);
  if (!selected) {
    return { outcome: 'unsupportedVariant', detail: paceGapFor(offers) ?? undefined };
  }

  const { offer, curve } = selected;
  // The MRZ unlocks the chip's nonce rather than the session itself: counter 3
  // is the password key, where BAC uses 1 and 2 for its session keys. The seed
  // is the UNTRUNCATED SHA-1 — see paceKeySeed for why that distinction matters
  // and how it fails when it is wrong.
  const passwordKey = offer.protocol.suite.deriveKey(p, paceKeySeed(p, mrz), 3);

  const transceive: PaceTransceive = async (command) => {
    const res = await transport.transceive(toBase64(command));
    return { data: fromBase64(res.data), statusWord: res.statusWord };
  };

  const sm = await runPaceEcdhGm({
    p,
    transceive,
    protocol: offer.protocol,
    curve,
    passwordKey,
  });
  return { sm, detail: `${describeProtocol(offer.protocol)} params=${offer.parameterId}` };
}

/** Whether a parameter id resolves to a curve this build runs. Test seam. */
export function supportsParameterId(id: number): boolean {
  return curveForParameterId(id) !== null;
}

export { PaceError };
