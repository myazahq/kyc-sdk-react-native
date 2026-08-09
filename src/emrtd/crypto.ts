import { concat, fromBase64, padToBlock, toBase64, xor } from './bytes';

// ---------------------------------------------------------------------------
// eMRTD crypto (ICAO 9303 Part 11).
//
// The small set of operations BAC is built from: two-key 3DES in CBC mode, the
// ISO 9797-1 Algorithm 3 "retail MAC", and the key-derivation function.
//
// The BLOCK CIPHERS come from the platform (see MyazaEmrtd.nitro.ts); the
// CONSTRUCTIONS on top of them are here, in TypeScript, because that is the
// part the standard specifies and the part worth testing. Every function below
// is checked against the worked example in ICAO 9303 Part 11 Appendix D — which
// is what makes this trustworthy without a passport in hand.
// ---------------------------------------------------------------------------

/** The block-cipher and digest operations the protocol needs. */
export interface EmrtdPrimitives {
  sha1(data: Uint8Array): Uint8Array;
  sha256(data: Uint8Array): Uint8Array;
  desEde2Cbc(key16: Uint8Array, data: Uint8Array, iv: Uint8Array, encrypt: boolean): Uint8Array;
  desBlock(key8: Uint8Array, block: Uint8Array, encrypt: boolean): Uint8Array;
  aesCbc(key: Uint8Array, data: Uint8Array, iv: Uint8Array, encrypt: boolean): Uint8Array;
  aesCmac(key: Uint8Array, data: Uint8Array): Uint8Array;
  randomBytes(length: number): Uint8Array;
}

/** Cipher-block size for DES/3DES, and the unit padding aligns to. */
export const BLOCK_SIZE = 8;

const ZERO_IV = new Uint8Array(BLOCK_SIZE);

/**
 * ISO 9797-1 Algorithm 3 MAC ("retail MAC"): single-DES-CBC the whole message
 * under the first half of the key, then decrypt the final block with the second
 * half and re-encrypt with the first.
 *
 * `data` must already be padded — the caller pads, because the same padded
 * bytes are needed for the MAC and (in secure messaging) for the length field.
 */
export function retailMac(
  p: EmrtdPrimitives,
  key16: Uint8Array,
  data: Uint8Array,
): Uint8Array {
  const k1 = key16.subarray(0, 8);
  const k2 = key16.subarray(8, 16);

  // CBC by hand: the primitive is a raw block cipher, and chaining is one XOR.
  let chain: Uint8Array = new Uint8Array(BLOCK_SIZE);
  for (let off = 0; off < data.length; off += BLOCK_SIZE) {
    const input = xor(data.subarray(off, off + BLOCK_SIZE), chain);
    chain = p.desBlock(k1, input, true);
  }

  return p.desBlock(k1, p.desBlock(k2, chain, false), true);
}

/**
 * Set the (cryptographically ignored) DES parity bits.
 *
 * DES discards the low bit of every key byte, so this changes nothing about the
 * cipher — but the standard's worked examples carry adjusted keys, and matching
 * them is how the derivation is verified.
 */
export function adjustParity(key: Uint8Array): Uint8Array {
  const out = new Uint8Array(key);
  for (let i = 0; i < out.length; i++) {
    let ones = 0;
    for (let bit = 1; bit < 8; bit++) if ((out[i]! & (1 << bit)) !== 0) ones++;
    out[i] = ones % 2 === 0 ? out[i]! | 0x01 : out[i]! & 0xfe;
  }
  return out;
}

/**
 * SHA-1 over a seed plus a 4-byte counter — the raw digest, before any
 * key-specific treatment. The counter is 1 for the encryption key, 2 for the
 * MAC key, 3 for the PACE password key.
 */
export function deriveDigestSha1(
  p: EmrtdPrimitives,
  seed: Uint8Array,
  counter: number,
): Uint8Array {
  return p.sha1(concat(seed, new Uint8Array([0, 0, 0, counter])));
}

/**
 * ICAO 9303 key derivation for 3DES: the leading 16 digest bytes, parity
 * adjusted. AES keys skip the parity step — it is a DES-only convention, and
 * applying it to an AES key silently produces the wrong key.
 */
export function deriveKey(
  p: EmrtdPrimitives,
  seed: Uint8Array,
  counter: number,
): Uint8Array {
  return adjustParity(deriveDigestSha1(p, seed, counter).subarray(0, 16));
}

// The MRZ-derived key lives in ./mrzKey; re-exported so callers keep one import.
export { keySeed, mrzKeySeedInput, type MrzKeyFields } from './mrzKey';

/** The pair of session keys derived from a seed. */
export interface SessionKeys {
  /** Encryption key (counter 1). */
  ksEnc: Uint8Array;
  /** MAC key (counter 2). */
  ksMac: Uint8Array;
}

export function deriveSessionKeys(p: EmrtdPrimitives, seed: Uint8Array): SessionKeys {
  return { ksEnc: deriveKey(p, seed, 1), ksMac: deriveKey(p, seed, 2) };
}

/** 3DES-CBC with the zero IV that BAC specifies. */
export function encrypt3Des(
  p: EmrtdPrimitives,
  key16: Uint8Array,
  data: Uint8Array,
): Uint8Array {
  return p.desEde2Cbc(key16, data, ZERO_IV, true);
}

export function decrypt3Des(
  p: EmrtdPrimitives,
  key16: Uint8Array,
  data: Uint8Array,
): Uint8Array {
  return p.desEde2Cbc(key16, data, ZERO_IV, false);
}

/** MAC over already-unpadded data — pads, then runs the retail MAC. */
export function macWithPadding(
  p: EmrtdPrimitives,
  key16: Uint8Array,
  data: Uint8Array,
): Uint8Array {
  return retailMac(p, key16, padToBlock(data, BLOCK_SIZE));
}

/** Adapts the native HybridObject (base64 in and out) to {@link EmrtdPrimitives}. */
export function primitivesFromNative(native: {
  sha1(d: string): string;
  sha256(d: string): string;
  desEde2Cbc(k: string, d: string, iv: string, e: boolean): string;
  desBlock(k: string, b: string, e: boolean): string;
  aesCbc(k: string, d: string, iv: string, e: boolean): string;
  aesCmac(k: string, d: string): string;
  randomBytes(n: number): string;
}): EmrtdPrimitives {
  const b = fromBase64;
  const s = toBase64;
  return {
    sha1: (d) => b(native.sha1(s(d))),
    sha256: (d) => b(native.sha256(s(d))),
    desEde2Cbc: (k, d, iv, e) => b(native.desEde2Cbc(s(k), s(d), s(iv), e)),
    desBlock: (k, blk, e) => b(native.desBlock(s(k), s(blk), e)),
    aesCbc: (k, d, iv, e) => b(native.aesCbc(s(k), s(d), s(iv), e)),
    aesCmac: (k, d) => b(native.aesCmac(s(k), s(d))),
    randomBytes: (n) => b(native.randomBytes(n)),
  };
}
