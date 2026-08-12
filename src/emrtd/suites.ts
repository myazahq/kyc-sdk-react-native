import { concat, padToBlock } from './bytes';
import {
  adjustParity,
  decrypt3Des,
  deriveDigestSha1,
  encrypt3Des,
  macWithPadding,
  retailMac,
  type EmrtdPrimitives,
} from './crypto';

// ---------------------------------------------------------------------------
// Cipher suites (ICAO 9303 Part 11 §9.7 and §9.8).
//
// BAC always runs two-key 3DES with the ISO 9797-1 retail MAC. PACE negotiates:
// it may use that same suite, or AES at 128, 192 or 256 bits with CMAC.
//
// They differ in more than the cipher, which is why this is one abstraction
// rather than a flag:
//
//   • AES has a 16-byte block, so the padding unit AND the send-sequence
//     counter are 16 bytes too.
//   • AES derives a fresh IV per message by encrypting the counter, where 3DES
//     uses a zero IV throughout.
//   • AES-192/256 key derivation moves from SHA-1 to SHA-256, because SHA-1
//     does not produce enough output.
//   • The PACE authentication token pads for the retail MAC but must NOT be
//     pre-padded for CMAC, which pads internally and takes a different branch
//     for exact block multiples.
//
// Each of those, gotten wrong, produces a session that handshakes cleanly and
// then fails on the first real command. So they are expressed here once.
// ---------------------------------------------------------------------------

export interface CipherSuite {
  readonly name: string;
  /** Cipher block size — also the padding unit and the SSC width. */
  readonly blockSize: number;
  /** Derived session-key length in bytes. */
  readonly keyLength: number;
  /** ICAO §9.7.1 key derivation: hash the secret with a 4-byte counter. */
  deriveKey(p: EmrtdPrimitives, secret: Uint8Array, counter: number): Uint8Array;
  /** `ssc` is present only for AES, which derives its IV from it. */
  encrypt(p: EmrtdPrimitives, key: Uint8Array, padded: Uint8Array, ssc?: Uint8Array): Uint8Array;
  decrypt(p: EmrtdPrimitives, key: Uint8Array, data: Uint8Array, ssc?: Uint8Array): Uint8Array;
  /** MAC over data the caller has already padded. */
  mac(p: EmrtdPrimitives, key: Uint8Array, data: Uint8Array): Uint8Array;
  /** The PACE authentication token over an UNPADDED encoding. */
  token(p: EmrtdPrimitives, key: Uint8Array, data: Uint8Array): Uint8Array;
}

/** Two-key 3DES with the retail MAC: what BAC always uses. */
export const DES_EDE2_SUITE: CipherSuite = {
  name: '3DES',
  blockSize: 8,
  keyLength: 16,
  deriveKey: (p, secret, counter) =>
    adjustParity(deriveDigestSha1(p, secret, counter).subarray(0, 16)),
  encrypt: (p, key, padded) => encrypt3Des(p, key, padded),
  decrypt: (p, key, data) => decrypt3Des(p, key, data),
  mac: (p, key, data) => retailMac(p, key, data),
  token: (p, key, data) => macWithPadding(p, key, data),
};

/** AES-CBC with CMAC, at 128, 192 or 256 bits. Only PACE reaches this. */
export function aesSuite(keyLength: 16 | 24 | 32): CipherSuite {
  return {
    name: `AES-${keyLength * 8}`,
    blockSize: 16,
    keyLength,
    deriveKey: (p, secret, counter) =>
      // AES-128 keeps SHA-1; the longer keys need SHA-256 for enough output.
      // No parity adjustment: that is a DES-only convention, and applying it to
      // an AES key silently produces a different key.
      keyLength === 16
        ? deriveDigestSha1(p, secret, counter).subarray(0, 16)
        : p.sha256(concat(secret, new Uint8Array([0, 0, 0, counter]))).subarray(0, keyLength),
    encrypt: (p, key, padded, ssc) => p.aesCbc(key, padded, aesIv(p, key, ssc), true),
    decrypt: (p, key, data, ssc) => p.aesCbc(key, data, aesIv(p, key, ssc), false),
    // ICAO truncates the 16-byte CMAC to its leading 8 bytes.
    mac: (p, key, data) => p.aesCmac(key, data).subarray(0, 8),
    token: (p, key, data) => p.aesCmac(key, data).subarray(0, 8),
  };
}

/**
 * The per-message IV: AES encrypts the send-sequence counter with the session
 * key, so two identical commands never produce identical ciphertext. A zero IV
 * here (the 3DES convention) would leak that they were the same.
 */
function aesIv(p: EmrtdPrimitives, key: Uint8Array, ssc?: Uint8Array): Uint8Array {
  if (!ssc) return new Uint8Array(16);
  return p.aesCbc(key, ssc, new Uint8Array(16), true);
}

/** Pad for this suite's block size (ISO 9797-1 method 2). */
export function padForSuite(suite: CipherSuite, data: Uint8Array): Uint8Array {
  return padToBlock(data, suite.blockSize);
}
