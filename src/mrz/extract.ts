import { parseMrz, type MrzScan } from './parse';

// ---------------------------------------------------------------------------
// Pulling an MRZ out of whatever the text recogniser returned.
//
// OCR output is messy: it may return the MRZ lines separately, merge them into
// one, split one across two, or interleave them with the rest of the photo
// page. Rather than trusting layout, this sanitises every line, keeps the
// MRZ-shaped ones, and tries each plausible grouping.
//
// Guessing is safe because CORRECTNESS COMES FROM THE CHECK DIGITS, not from
// this file. Anything a grouping produces still has to validate in `parseMrz`,
// so a wrong guess is discarded rather than believed.
// ---------------------------------------------------------------------------

/** Strips everything that cannot appear in an MRZ and upper-cases the rest. */
export function sanitizeMrzLine(raw: string): string {
  return (
    raw
      .toUpperCase()
      // ML Kit's latin model (Android) reads OCR-B's '<' filler as guillemets
      // constantly — '«' for a '<<' pair, '‹' for a single. Stripping them (the
      // old behaviour) SHORTENED the line past what `fit` tolerates, which is a
      // big part of why Android never had the MRZ after the first capture.
      // Mapping is safe here for the same reason every guess in this file is:
      // the check digits decide, not us.
      .replace(/«/g, '<<')
      .replace(/»/g, '<<')
      .replace(/[‹›]/g, '<')
      .replace(/[^A-Z0-9<]/g, '')
  );
}

/**
 * Whether a line looks like part of an MRZ rather than ordinary page text.
 *
 * MRZ lines are filler-padded, so `<` density is the strongest signal — far
 * more reliable than length alone, since a passport's printed fields produce
 * plenty of long lines.
 */
export function looksLikeMrzLine(sanitized: string): boolean {
  if (sanitized.length < 28) return false;
  const fillers = (sanitized.match(/</g) ?? []).length;
  return fillers >= 2;
}

/**
 * Coerce a candidate to exactly `width`.
 *
 * Recognisers commonly clip a trailing filler or bolt on a stray glyph from the
 * page edge, so a near-miss is worth one attempt — the check digits reject it
 * if the guess was wrong, which costs nothing but a frame.
 */
function fit(line: string, width: number): string | null {
  if (line.length === width) return line;
  // Short by a filler or two: MRZ lines are '<'-padded on the right.
  if (line.length >= width - 2 && line.length < width) return line.padEnd(width, '<');
  // Long by a stray glyph or three: drop the trailing noise.
  if (line.length > width && line.length <= width + 3) return line.slice(0, width);
  // A filler run the recogniser miscounted. Android returns runs of '<' as
  // guillemets whose number does not match the fillers printed, so the mapped
  // run overshoots or falls short by many characters (a passport's first line
  // came back 53 wide on the Flutter SDK, 2026-09-15). Trailing fillers are
  // padding and carry no data, so only they are removed or added.
  if (line.length > width && !/[^<]/.test(line.slice(width))) return line.slice(0, width);
  if (line.length < width && line.length >= Math.floor(width / 2) && line.endsWith('<')) {
    return line.padEnd(width, '<');
  }
  return null;
}

/**
 * Read an MRZ out of one frame's recognised lines, or null when this frame does
 * not carry a complete, valid one.
 */
export function extractMrz(recognizedLines: string[], now: Date = new Date()): MrzScan | null {
  const pieces = recognizedLines.map(sanitizeMrzLine).filter((line) => line.length > 0);
  const candidates = pieces.filter(looksLikeMrzLine);
  if (candidates.length === 0) return fromFragments(pieces, now);

  // 1) A single line already holding the whole MRZ (some recognisers merge).
  for (const line of candidates) {
    if (line.length === 88 || line.length === 90) {
      const scan = parseMrz(line, now);
      if (scan) return scan;
    }
  }

  // 2) TD3 — two adjacent 44-char lines.
  for (let i = 0; i + 1 < candidates.length; i++) {
    const a = fit(candidates[i]!, 44);
    const b = fit(candidates[i + 1]!, 44);
    if (!a || !b) continue;
    const scan = parseMrz(a + b, now);
    if (scan) return scan;
  }

  // 3) TD1 — three adjacent 30-char lines.
  for (let i = 0; i + 2 < candidates.length; i++) {
    const a = fit(candidates[i]!, 30);
    const b = fit(candidates[i + 1]!, 30);
    const c = fit(candidates[i + 2]!, 30);
    if (!a || !b || !c) continue;
    const scan = parseMrz(a + b + c, now);
    if (scan) return scan;
  }

  return fromFragments(pieces, now);
}

// ---------------------------------------------------------------------------
// Split lines.
//
// On a high-resolution still, Android's recogniser can return ONE printed MRZ
// line as two text lines (seen on the Flutter SDK, 2026-09-15: a passport's
// two-line band came back as three lines). Joining runs of adjacent pieces back
// to line width recovers it; a wrong join is harmless, as above. Mirrored in
// kyc-sdk-flutter's mrz_extract.dart.
// ---------------------------------------------------------------------------

/** The longest run of pieces one printed line is ever split into. */
const MAX_PIECES_PER_LINE = 4;

interface JoinedRow {
  end: number;
  text: string;
}

/** Joined rows of `width`, keyed by the index of the piece each one starts at. */
function rowsByStart(pieces: string[], width: number): Map<number, JoinedRow[]> {
  const rows = new Map<number, JoinedRow[]>();
  for (let i = 0; i < pieces.length; i++) {
    let text = '';
    for (let j = i; j < pieces.length && j < i + MAX_PIECES_PER_LINE; j++) {
      text += pieces[j]!;
      // Generous: a joined row may carry an over-counted filler run `fit` trims.
      if (text.length > width * 2) break;
      const fitted = fit(text, width);
      if (fitted) rows.set(i, [...(rows.get(i) ?? []), { end: j, text: fitted }]);
    }
  }
  return rows;
}

/** Consecutive joined rows of line width: TD3 two of 44, TD1 three of 30. */
function fromFragments(pieces: string[], now: Date): MrzScan | null {
  const td3 = rowsByStart(pieces, 44);
  for (const list of td3.values()) {
    for (const a of list) {
      for (const b of td3.get(a.end + 1) ?? []) {
        const scan = parseMrz(a.text + b.text, now);
        if (scan) return scan;
      }
    }
  }
  const td1 = rowsByStart(pieces, 30);
  for (const list of td1.values()) {
    for (const a of list) {
      for (const b of td1.get(a.end + 1) ?? []) {
        for (const c of td1.get(b.end + 1) ?? []) {
          const scan = parseMrz(a.text + b.text + c.text, now);
          if (scan) return scan;
        }
      }
    }
  }
  return null;
}
