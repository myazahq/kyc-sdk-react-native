import { fromAscii } from './bytes';
import type { EmrtdPrimitives } from './crypto';

// ---------------------------------------------------------------------------
// The BAC key, derived from the printed MRZ.
//
// This is what makes Basic Access Control work at all: the chip will only talk
// to someone who has physically seen the document, because the key comes from
// the strip printed on it.
//
// Split from crypto.ts (200-line rule) because it is the one part that is about
// the DOCUMENT rather than the ciphers.
// ---------------------------------------------------------------------------

/** ICAO 7-3-1 weighted check digit over the MRZ alphabet. */
function checkDigit(value: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    const v = ch >= 0x30 && ch <= 0x39 ? ch - 0x30 : ch >= 0x41 && ch <= 0x5a ? ch - 0x41 + 10 : 0;
    sum += v * weights[i % 3]!;
  }
  return sum % 10;
}

export interface MrzKeyFields {
  documentNumber: string;
  /** YYMMDD, as it appears in the MRZ. */
  dateOfBirth: string;
  dateOfExpiry: string;
}

/**
 * The MRZ information BAC hashes: document number, date of birth and expiry,
 * each followed by its own check digit.
 *
 * The document number is filler-padded to nine characters FIRST, and the check
 * digit is computed over the padded form — getting that order wrong yields a
 * key the chip rejects with no explanation.
 */
export function mrzKeySeedInput(fields: MrzKeyFields): string {
  const field = (v: string): string => `${v}${checkDigit(v)}`;
  return (
    field(fields.documentNumber.padEnd(9, '<')) +
    field(fields.dateOfBirth) +
    field(fields.dateOfExpiry)
  );
}

/** Kseed for BAC: the first 16 bytes of SHA-1 over the MRZ information. */
export function keySeed(p: EmrtdPrimitives, fields: MrzKeyFields): Uint8Array {
  return p.sha1(fromAscii(mrzKeySeedInput(fields))).subarray(0, 16);
}

/**
 * The seed PACE derives its password key from: the FULL SHA-1 digest, NOT
 * truncated to 16 bytes.
 *
 * This is the one place the two protocols disagree about the same hash, and it
 * is silent when wrong: a truncated seed yields a valid-looking K_π, the
 * handshake runs to its last step, and the chip answers 0x6300 — which reads
 * exactly like a mistyped MRZ rather than a derivation bug. It cost this SDK a
 * real passport read to find (the same document opened over BAC moments later,
 * proving the MRZ was right).
 *
 * ICAO 9303 Part 11 keeps the two apart: §9.7.3 truncates for BAC's Kseed,
 * while §9.7.2 feeds the whole digest to KDF_π. JMRTD encodes the same split as
 * `computeKeySeedForBAC(… truncate: true)` vs `computeKeySeedForPACE(…
 * truncate: false)`.
 */
export function paceKeySeed(p: EmrtdPrimitives, fields: MrzKeyFields): Uint8Array {
  return p.sha1(fromAscii(mrzKeySeedInput(fields)));
}
