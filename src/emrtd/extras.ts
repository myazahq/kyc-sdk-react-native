import { findTlv, readTlv } from './der';
import { EF, type Transceive } from './files';
import { readOptionalFile } from './optionalRead';
import type { SecureMessagingSession } from './secureMessaging';

// ---------------------------------------------------------------------------
// The optional detail groups: DG7 (displayed signature image), DG11
// (additional personal details), DG12 (additional document details).
//
// All three are BAC-readable like DG1/DG2, small (a few KB between them), and
// OPTIONAL BY STANDARD — many issuers simply do not write them. So the read is
// gated on EF.COM, the chip's own table of contents: one tiny file names
// exactly which data groups exist, and absent groups are skipped instead of
// being probed with SELECTs the chip will refuse. When COM itself cannot be
// read (or does not parse), every group is attempted best-effort — the worst
// case is a fast refusal per absent file, which readOptionalFile absorbs.
//
// Deliberately read LAST, after the portrait: they are nice-to-have context,
// and a session that drops while fetching them has already banked everything
// that matters. Like DG2 they are only read once the SOD arrived — the server
// authenticates each group against it, and an unverifiable extra is one an
// attacker could have substituted.
//
// (DG3/DG4 — fingerprints and iris — are NOT here and never will be: they sit
// behind Extended Access Control, decryptable only by government inspection
// systems holding terminal-authentication certificates.)
// ---------------------------------------------------------------------------

/** LDS1 data-group tag byte → DG number (ICAO 9303-10). */
const TAG_TO_DG: Readonly<Record<number, number>> = {
  0x61: 1, 0x75: 2, 0x63: 3, 0x76: 4, 0x65: 5, 0x66: 6, 0x67: 7, 0x68: 8,
  0x69: 9, 0x6a: 10, 0x6b: 11, 0x6c: 12, 0x6d: 13, 0x6e: 14, 0x6f: 15, 0x70: 16,
};

/**
 * Parse EF.COM's data-group presence list (tag 5C inside the outer 60).
 * Null when the bytes do not parse as a COM — the caller then probes instead.
 */
export function parseComDataGroups(com: Uint8Array): Set<number> | null {
  const outer = readTlv(com);
  if (!outer || outer.tag !== 0x60) return null;
  const list = findTlv(outer.value, 0x5c);
  if (!list) return null;
  const present = new Set<number>();
  for (const byte of list.value) {
    const dg = TAG_TO_DG[byte];
    if (dg !== undefined) present.add(dg);
  }
  return present;
}

export interface ExtraGroupReads {
  dg7: Uint8Array | null;
  dg11: Uint8Array | null;
  dg12: Uint8Array | null;
}

/**
 * Read whichever of DG7/DG11/DG12 the chip declares (or, without a readable
 * COM, whichever answer). Every read is best-effort — a failure costs the
 * group, never the session's banked result.
 */
export async function readExtraGroups(
  sm: SecureMessagingSession,
  transceive: Transceive,
): Promise<ExtraGroupReads> {
  const com = await readOptionalFile(sm, transceive, EF.COM, 'EF.COM');
  const declared = com ? parseComDataGroups(com) : null;
  const want = (dg: number): boolean => declared === null || declared.has(dg);

  return {
    dg7: want(7) ? await readOptionalFile(sm, transceive, EF.DG7, 'DG7') : null,
    dg11: want(11) ? await readOptionalFile(sm, transceive, EF.DG11, 'DG11') : null,
    dg12: want(12) ? await readOptionalFile(sm, transceive, EF.DG12, 'DG12') : null,
  };
}
