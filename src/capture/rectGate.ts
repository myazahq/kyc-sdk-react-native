import type { DocumentHint } from './documentIdentity';

// ---------------------------------------------------------------------------
// Judging a detected document rectangle — the PURE half of edge detection.
//
// Split from rectDetector.ts on purpose: that module binds the native detector
// and so drags react-native-nitro-modules into whatever imports it. The
// thresholds below are the part worth testing, and they must be reachable in
// CI with no device and no native build.
//
// Geometry NEVER decides alone. An aspect ratio cannot tell a passport from a
// driver's licence, so a capture that fired on shape would shoot the wrong
// document — the text gate establishes identity; this only says whether what is
// there is presented like a document.
// ---------------------------------------------------------------------------

/** The measured box, as the native detector reports it (normalised 0..1). */
export interface MeasuredRect {
  found: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  aspect: number;
  confidence: number;
}

export interface RectGateOptions {
  /** Expected width ÷ height: 1.586 for ID cards, 1.42 for a passport page. */
  expectedAspect: number;
  /** How far the observed aspect may stray, as a fraction of the expected. */
  aspectTolerance?: number;
  /** Smallest share of the frame the document may cover. */
  minArea?: number;
  /** Largest share — beyond this the corners are being cut off. */
  maxArea?: number;
  /** Clearance every edge must keep from the frame border. */
  minMargin?: number;
}

/**
 * Judge a detected rectangle. Returns the framing complaint, or null when the
 * shape is acceptable — and null ALSO when nothing was detected, because
 * "no geometry" must not read as "badly framed" on a platform that cannot
 * measure. The text gate still has to agree either way.
 */
export function rectFramingProblem(
  rect: MeasuredRect | null,
  {
    expectedAspect,
    aspectTolerance = 0.35,
    minArea = 0.12,
    maxArea = 0.92,
    minMargin = 0.01,
  }: RectGateOptions,
): DocumentHint | null {
  if (!rect || !rect.found) return null;

  // SHAPE. The detector will happily segment a book, a receipt or a laptop;
  // aspect is what tells an ID document apart from them.
  //
  // Compared against BOTH orientations: a document held in landscape and one
  // held in portrait are the same document, and the detector reports whatever
  // it saw. Rejecting the rotated case would refuse a perfectly good frame.
  const observed = rect.aspect;
  const alt = observed > 0 ? 1 / observed : 0;
  const matches =
    Math.abs(observed - expectedAspect) <= expectedAspect * aspectTolerance ||
    Math.abs(alt - expectedAspect) <= expectedAspect * aspectTolerance;
  if (!matches) return 'wrongDocument';

  // SIZE. Big enough that the crop keeps the detail OCR and the MRZ need, but
  // not so big that it is overflowing the frame.
  const area = rect.width * rect.height;
  if (area < minArea) return 'moveCloser';
  if (area > maxArea) return 'moveBack';

  // MARGIN. Every edge clear of the border, so all four corners are in shot. A
  // document cropped flush to an edge loses characters, and OCR reads edges
  // worst.
  if (
    rect.x < minMargin ||
    rect.y < minMargin ||
    rect.x + rect.width > 1 - minMargin ||
    rect.y + rect.height > 1 - minMargin
  ) {
    return 'moveBack';
  }

  return null;
}
