import { extractChipPortrait } from '../emrtd/dg2';

// ---------------------------------------------------------------------------
// Finding the portrait inside DG2.
//
// DG2 is a CBEFF container, not an image file — the picture sits after a
// biometric header whose layout varies by issuer, which is why this scans for
// the image's own magic bytes rather than walking the structure.
//
// The distinction that matters is JPEG vs JPEG 2000: only the first can be
// rendered by React Native, and a passport that stores JP2 (most of them) must
// report "recognised but not renderable" rather than looking like a parse
// failure. A missing preview is never an error.
// ---------------------------------------------------------------------------

/** base64 of the given bytes, prefixed with `pad` filler bytes. */
function dg2(pad: number[], image: number[]): string {
  return Buffer.from(Uint8Array.from([...pad, ...image])).toString('base64');
}

// A plausible CBEFF-ish preamble — arbitrary, which is the point: the scan
// must not depend on its length or content.
const HEADER = [0x7f, 0x61, 0x82, 0x01, 0x2a, 0x02, 0x01, 0x01, 0x7f, 0x60];

describe('extractChipPortrait', () => {
  it('finds a JPEG after the biometric header and renders it', () => {
    const uri = extractChipPortrait(dg2(HEADER, [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]));
    expect(uri.format).toBe('jpeg');
    expect(uri.dataUri).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('hands back the IMAGE bytes, not the DG2 container, for the platform to decode', () => {
    // DG2 is a biometric container with a header in front of the picture.
    // Passing the whole blob to an image decoder asks it to recognise a file
    // format that is not at offset zero, and it declines — which is exactly why
    // the chip portrait stayed blank on the passports that store JPEG 2000.
    const jp2 = extractChipPortrait(
      dg2(HEADER, [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a]),
    );
    const sliced = Buffer.from(jp2.imageBase64!, 'base64');
    expect(sliced[0]).toBe(0x00);
    expect(sliced[4]).toBe(0x6a); // 'j' of the JP2 signature box — header gone
  });

  it('reports JPEG 2000 as recognised but not renderable', () => {
    // The common passport case. It must be distinguishable from "unknown" so
    // the panel can say "no preview" rather than implying the read failed.
    const jp2 = extractChipPortrait(
      dg2(HEADER, [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a]),
    );
    expect(jp2.format).toBe('jp2');
    expect(jp2.dataUri).toBeNull();
  });

  it('recognises a raw J2K codestream as the same verdict', () => {
    // Some chips store the codestream unwrapped rather than in a JP2 box.
    // Both collapse to one `jp2` verdict on purpose: the caller's only
    // question is "can this be shown", and the answer is no either way.
    const j2k = extractChipPortrait(dg2(HEADER, [0xff, 0x4f, 0xff, 0x51, 0x00, 0x2f]));
    expect(j2k.format).toBe('jp2');
    expect(j2k.dataUri).toBeNull();
  });

  it('degrades quietly on absent, malformed or imageless input', () => {
    // None of these is worth an error: the chip data still goes to the server,
    // which is what actually verifies it.
    expect(extractChipPortrait(undefined).dataUri).toBeNull();
    expect(extractChipPortrait('not base64 !!!').dataUri).toBeNull();
    expect(extractChipPortrait(dg2(HEADER, [0x01, 0x02, 0x03])).format).toBe('unknown');
  });
});

// The chip read's narration. Android has no system NFC UI, so these strings
// ARE the feedback — and a read that looks silent is one users abort by lifting
// the document. Wording is shared with the iOS sheet and the Flutter SDK.
import {
  NFC_STAGE_ORDER,
  nfcStageLabel,
  nfcStageProgress,
  type NfcReadStage,
} from '../emrtd/stages';

describe('NFC read stages', () => {
  it('runs in the order the chip is actually read', () => {
    // EF.SOD before DG2 is not cosmetic: an unverifiable portrait is one an
    // attacker could have substituted, so the photo is only worth reading once
    // the signed security object has arrived.
    expect(NFC_STAGE_ORDER).toEqual([
      'waiting',
      'authenticating',
      'readingData',
      'readingSecurity',
      'readingPhoto',
      'readingDetails',
      'done',
    ]);
  });

  it('advances monotonically, ending at 1', () => {
    const values = NFC_STAGE_ORDER.map(nfcStageProgress);
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(1);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });

  it('labels every stage', () => {
    for (const s of NFC_STAGE_ORDER) {
      expect(nfcStageLabel(s as NfcReadStage).length).toBeGreaterThan(0);
    }
  });
});
