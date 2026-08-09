import { fromBase64, toBase64 } from './bytes';

// ---------------------------------------------------------------------------
// The chip's portrait (DG2).
//
// DG2 is a CBEFF container, not an image file: the picture sits somewhere
// inside a biometric header, and the only dependable way to find it is to scan
// for the image's own magic bytes. That is what this does.
//
// Two encodings occur in practice, and the difference decides whether anything
// can be shown at all:
//
//   • JPEG (FF D8 FF) — renders anywhere, so it becomes a data URI.
//   • JPEG 2000 (JP2 / raw J2K codestream) — the COMMON case on passports, and
//     React Native cannot decode it. There is no shame in that: the read still
//     stands, the bytes still go to the server, and the panel simply shows the
//     generic success mark instead of a face.
//
// So a missing preview is NEVER an error. The portrait is a confirmation for
// the user, not evidence — the server is what verifies DG2 against the signed
// security object.
// ---------------------------------------------------------------------------

export type PortraitFormat = 'jpeg' | 'jp2' | 'unknown';

export interface ChipPortrait {
  format: PortraitFormat;
  /** A `data:` URI, only when the format is one RN can actually render. */
  dataUri: string | null;
  /**
   * The IMAGE bytes, base64, sliced out of the CBEFF container — for handing to
   * a platform decoder when RN cannot render the format itself.
   *
   * This is not the same as the DG2 blob. DG2 is a biometric container with a
   * header in front of the picture; passing the whole thing to an image decoder
   * asks it to recognise a file format that is not there, and it will decline.
   * The offset is already known here, so the slice is free.
   */
  imageBase64: string | null;
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
// JP2 container: the 12-byte signature box.
const JP2_MAGIC = [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20];
// Raw JPEG 2000 codestream (SOC + SIZ), which some chips store unwrapped.
const J2K_MAGIC = [0xff, 0x4f, 0xff, 0x51];

function indexOfBytes(haystack: Uint8Array, needle: number[], from = 0): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Find the portrait inside a DG2 elementary file.
 *
 * Scanning for magic bytes rather than walking the CBEFF/BIT structure is
 * deliberate: the header layout varies between issuers, and a parser that is
 * wrong about one of them returns nothing, while the magic bytes are fixed by
 * the image formats themselves.
 */
export function extractChipPortrait(dg2Base64: string | undefined): ChipPortrait {
  if (!dg2Base64) return { format: 'unknown', dataUri: null, imageBase64: null };

  let bytes: Uint8Array;
  try {
    bytes = fromBase64(dg2Base64);
  } catch {
    return { format: 'unknown', dataUri: null, imageBase64: null };
  }

  // EARLIEST signature wins, exactly like the Flutter SDK. Checking formats in
  // preference order instead was subtly wrong: 20KB of compressed JPEG 2000
  // wavelet data can contain a spurious `FF D8 FF` by chance, and preferring
  // JPEG meant slicing at that garbage offset — producing a "jpeg" data URI
  // that renders as nothing, while the real, decodable JP2 header sat earlier
  // in the file, never consulted. The image's true start is the FIRST magic in
  // the container.
  const candidates: Array<[PortraitFormat, number[]]> = [
    ['jpeg', JPEG_MAGIC],
    ['jp2', JP2_MAGIC],
    ['jp2', J2K_MAGIC],
  ];
  let format: PortraitFormat = 'unknown';
  let at = -1;
  for (const [candidate, magic] of candidates) {
    const index = indexOfBytes(bytes, magic);
    if (index >= 0 && (at < 0 || index < at)) {
      at = index;
      format = candidate;
    }
  }

  if (at < 0) return { format: 'unknown', dataUri: null, imageBase64: null };

  // Sliced from the magic bytes onward: a renderer or platform decoder needs
  // the image FILE, not the biometric container it is wrapped in.
  const imageBase64 = toBase64(bytes.subarray(at));
  return {
    format,
    // Only baseline JPEG renders directly in RN; JP2 is reported honestly so a
    // caller can hand it to the platform decoder — and so "no preview" is
    // distinguishable from a DG2 that failed to parse at all.
    dataUri: format === 'jpeg' ? `data:image/jpeg;base64,${imageBase64}` : null,
    imageBase64,
  };
}
