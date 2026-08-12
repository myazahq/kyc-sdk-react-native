import { fromBase64 } from './bytes';
import { findTlvDeep } from './der';
import { parseMrz, type MrzScan } from '../mrz/parse';

// ---------------------------------------------------------------------------
// THE CHIP'S OWN MRZ.
//
// DG1 is the machine-readable zone exactly as the ISSUING STATE wrote it, and
// passive authentication hashes it against the signed security object. It is
// the strongest copy of the holder's details that exists on the document.
//
// The camera scan is a GUESS at the same characters, and it is not a safe
// substitute for display. Measured on a real Nigerian passport read on a Galaxy
// S24: the on-device recogniser read the first '<' of the '<<' surname
// separator as 'K', so `INGWE<<RICHARD<UNIMKE` arrived as `INGWEK<RICHARD…`.
// The split then never fired at the surname boundary and landed in the trailing
// filler instead, yielding lastName "INGWEK RICHARD UNIMKE" and firstName
// "KKKK" — displayed under a caption promising we had read the secure chip.
//
// TD3 carries NO check digit over the name field (only line 2 is protected), so
// that corruption passes `parseMrz` validation silently. There is no way to
// detect it from the scan alone, which is exactly why the chip has to be the
// source once we hold it.
//
// Reuses `parseMrz` rather than parsing here: DG1's value IS the continuous
// 88/90-character string that function already takes, and a second MRZ parser
// would be one more thing to drift.
// ---------------------------------------------------------------------------

/** DG1's MRZ lives under tag 5F1F, inside the 0x61 template. */
const TAG_MRZ = 0x5f1f;

/**
 * The MRZ read off the chip, or null when DG1 is absent, malformed, or not a
 * size `parseMrz` recognises.
 *
 * Null is a normal outcome the caller falls back from, never an error: the
 * read itself already succeeded and its bytes still go to the server, which
 * parses DG1 authoritatively regardless of what this returns.
 */
export function parseDg1(dg1Base64: string | undefined | null): MrzScan | null {
  if (!dg1Base64) return null;
  try {
    const bytes = fromBase64(dg1Base64);
    const mrz = findTlvDeep(bytes, TAG_MRZ);
    if (!mrz) return null;
    let text = '';
    for (const byte of mrz.value) text += String.fromCharCode(byte);
    return parseMrz(text);
  } catch {
    // Display-path only. A malformed DG1 must never take down the success
    // screen of a read that otherwise worked.
    return null;
  }
}
