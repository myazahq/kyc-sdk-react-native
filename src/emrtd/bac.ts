import { concat, timingSafeEqual } from './bytes';
import {
  decrypt3Des,
  deriveSessionKeys,
  encrypt3Des,
  keySeed,
  macWithPadding,
  type EmrtdPrimitives,
  type MrzKeyFields,
  type SessionKeys,
} from './crypto';

// ---------------------------------------------------------------------------
// Basic Access Control (ICAO 9303 Part 11 §4.3).
//
// A mutual authentication that proves both sides know a key derived from the
// printed MRZ — which is the point: the chip only talks to someone who has
// physically seen the document.
//
//   1. Ask the chip for a challenge (RND.IC).
//   2. Send back RND.IFD | RND.IC | K.IFD, encrypted and MACed under the MRZ
//      keys.
//   3. The chip returns RND.IC | RND.IFD | K.IC the same way.
//   4. Both sides XOR K.IFD with K.IC to get the session seed.
//
// Step 3 is where the chip is AUTHENTICATED: a chip that cannot produce a valid
// MAC, or that echoes back the wrong nonce, does not hold the key. Both checks
// below are mandatory — skipping the nonce check in particular would accept a
// replayed response from an earlier session.
//
// Pure: no I/O. The caller does the APDU exchange, which is what makes this
// testable against the standard's worked example.
// ---------------------------------------------------------------------------

/** What to send the chip, and what is needed to check its reply. */
export interface BacChallenge {
  /** The EXTERNAL AUTHENTICATE command data: E.IFD | M.IFD (40 bytes). */
  command: Uint8Array;
  /** Kept for the reply check — never leaves this process. */
  rndIfd: Uint8Array;
  rndIc: Uint8Array;
  kIfd: Uint8Array;
  kEnc: Uint8Array;
  kMac: Uint8Array;
}

/**
 * Build the mutual-authenticate command from the chip's challenge.
 *
 * `rndIfd` and `kIfd` are injectable so the ICAO worked example can be
 * reproduced exactly; production leaves them out and takes real randomness.
 * They MUST be unpredictable in production — a fixed RND.IFD makes the whole
 * exchange replayable.
 */
export function buildBacChallenge(
  p: EmrtdPrimitives,
  mrz: MrzKeyFields,
  rndIc: Uint8Array,
  fixed?: { rndIfd?: Uint8Array; kIfd?: Uint8Array },
): BacChallenge {
  const seed = keySeed(p, mrz);
  const { ksEnc: kEnc, ksMac: kMac } = deriveSessionKeys(p, seed);

  const rndIfd = fixed?.rndIfd ?? p.randomBytes(8);
  const kIfd = fixed?.kIfd ?? p.randomBytes(16);

  const s = concat(rndIfd, rndIc, kIfd);
  const eIfd = encrypt3Des(p, kEnc, s);
  const mIfd = macWithPadding(p, kMac, eIfd);

  return { command: concat(eIfd, mIfd), rndIfd, rndIc, kIfd, kEnc, kMac };
}

export class BacError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BacError';
    Object.setPrototypeOf(this, BacError.prototype);
  }
}

/**
 * Verify the chip's reply and derive the session.
 *
 * Throws {@link BacError} when the chip fails to prove it holds the key. That
 * is not a "retry" condition — it means the MRZ was read wrong, or the thing
 * answering is not the document.
 */
export function completeBac(
  p: EmrtdPrimitives,
  challenge: BacChallenge,
  response: Uint8Array,
): { keys: SessionKeys; ssc: Uint8Array } {
  if (response.length !== 40) {
    throw new BacError(`Unexpected response length ${response.length}; expected 40.`);
  }

  const eIc = response.subarray(0, 32);
  const mIc = response.subarray(32, 40);

  // The MAC first: without it, everything decrypted below is attacker-chosen.
  if (!timingSafeEqual(macWithPadding(p, challenge.kMac, eIc), mIc)) {
    throw new BacError('The chip’s response failed its integrity check.');
  }

  const r = decrypt3Des(p, challenge.kEnc, eIc);
  const rndIcEcho = r.subarray(0, 8);
  const rndIfdEcho = r.subarray(8, 16);
  const kIc = r.subarray(16, 32);

  // Both nonces must come back. Checking only the MAC would accept a replayed
  // response from an earlier session with the same document.
  if (!timingSafeEqual(rndIcEcho, challenge.rndIc)) {
    throw new BacError('The chip echoed the wrong challenge.');
  }
  if (!timingSafeEqual(rndIfdEcho, challenge.rndIfd)) {
    throw new BacError('The chip echoed the wrong terminal nonce.');
  }

  const seed = new Uint8Array(16);
  for (let i = 0; i < 16; i++) seed[i] = challenge.kIfd[i]! ^ kIc[i]!;

  // The send-sequence counter starts as the low four bytes of each nonce, in
  // that order — it is incremented before every secure-messaging command.
  const ssc = concat(challenge.rndIc.subarray(4, 8), challenge.rndIfd.subarray(4, 8));

  return { keys: deriveSessionKeys(p, seed), ssc };
}
