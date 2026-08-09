import { detectDocumentType, hasDocumentSignals, hasMrzLines } from './documentSignals';

// ---------------------------------------------------------------------------
// Document identity.
//
// "Is the thing in frame the document the user picked?" — answered from
// recognized text, so a capture clears the same bar on both platforms.
//
// Text ALONE cannot answer it either: the word "passport" appears in prose, in
// code, and on any screen showing KYC documentation — which is exactly how a
// laptop screen full of text once identified as a passport and fired.
//
// So identity is deliberately strict about the one document that can prove
// itself: an MRZ. Only travel documents carry one, it is always on the page a
// passport capture is meant to frame, and it validates by check digit — so for
// passports the machine-readable zone, not the printed word, is the proof.
// ---------------------------------------------------------------------------

/**
 * What to actually tell the user. The gate rejects for several distinct
 * reasons, and collapsing them into one "align your ID" message left people
 * stuck: the commonest failure is holding the document TOO CLOSE, where the
 * instinct is to move nearer still.
 */
export type DocumentHint =
  | 'searching'
  | 'moreLight'
  | 'wrongDocument'
  | 'moveCloser'
  /** Overflowing — corners are cut. THIS is the one users cannot guess. */
  | 'moveBack'
  | 'centre'
  /**
   * Passport only: the page is readable but the machine-readable strip is not
   * in frame. Auto-capture waits for it (it is the chip's key and the proof the
   * page is a passport), so a generic "move closer" sends the user the wrong way.
   */
  | 'showMrz'
  | 'holdStill'
  | 'captured';

export type DocumentFraming =
  | 'none'
  | 'wrongShape'
  | 'adjust'
  | 'holding'
  | 'ready';

export interface DocumentGuidance {
  framing: DocumentFraming;
  hint: DocumentHint;
}

export interface DocumentIdentityResult {
  identified: boolean;
  /** Meaningful only when `identified` is false. */
  hint: DocumentHint;
}

/** ID types whose page always carries a machine-readable zone. */
export function documentCarriesMrz(idType: string): boolean {
  return idType === 'passport';
}

export interface VerifyIdentityOptions {
  country: string;
  idType: string;
  /**
   * Which face of the document is being photographed. Identity KEYWORDS live
   * on the FRONT — the branding, the document name, the issuer. The back of a
   * card (a PVC's barcode-and-address side, a licence's magstripe side)
   * carries none of them, so demanding them there means the back can never
   * auto-capture. By the time the back is up, the user has captured and
   * confirmed the front of the right document seconds ago — identity is
   * established; the back only has to be framed, text-bearing and still.
   */
  side?: 'front' | 'back';
  /** The chip step needs the MRZ as a key, so demand a check-digit-valid read. */
  requireValidMrz?: boolean;
  hasValidMrz?: boolean;
  /** The key is already stored from an earlier frame. */
  mrzAlreadyCaptured?: boolean;
  minConfidence?: number;
  wrongTypeMargin?: number;
}

/** Verifies that `lines` identify the document the user picked. */
export function verifyDocumentIdentity(
  lines: string[],
  {
    country,
    idType,
    side = 'front',
    requireValidMrz = false,
    hasValidMrz = false,
    mrzAlreadyCaptured = false,
    minConfidence = 0.34,
    wrongTypeMargin = 0.34,
  }: VerifyIdentityOptions,
): DocumentIdentityResult {
  if (lines.length === 0) return { identified: false, hint: 'searching' };
  const isBack = side === 'back';

  // ── The MRZ rule ────────────────────────────────────────────────────────
  // For an MRZ-bearing document the zone must actually be in frame. This is
  // what rejects a screen, a printout, or a page that merely mentions the word.
  // Front only: the strip lives on the photo page.
  if (!isBack && documentCarriesMrz(idType) && !hasValidMrz && !hasMrzLines(lines)) {
    // Say WHICH problem it is. Text that already reads as the expected document
    // is most likely the real thing with the strip cropped off the bottom edge
    // — the commonest passport framing mistake — and telling that user "wrong
    // document" sends them hunting for a different one.
    const looksRight = detectDocumentType(lines, country).type === idType;
    return { identified: false, hint: looksRight ? 'showMrz' : 'wrongDocument' };
  }

  // ── Keyword identity ────────────────────────────────────────────────────
  // Only where signals exist: most Global Documents countries have no curated
  // list, and there we must not block on a check we cannot perform.
  if (hasDocumentSignals(country, idType)) {
    const match = detectDocumentType(lines, country);
    const expected = match.type === idType ? match.confidence : 0;

    // Reading clearly as a DIFFERENT document — the server would reject this
    // after upload as `document_type_mismatch`, so say so now. This arm runs
    // for the back too: its keywords are absent from card backs, so a hit
    // means a different document's FRONT swapped into the frame.
    if (match.type != null && match.type !== idType && match.confidence >= expected + wrongTypeMargin) {
      return { identified: false, hint: 'wrongDocument' };
    }

    // Two independent keyword hits identify the document, whatever the length
    // of its synonym list. Confidence alone is a ratio, so a type with a
    // thorough list is HARDER to recognise than a sparse one. REQUIRED on the
    // front only — the back carries no branding to match.
    const identifiedByCount = match.type === idType && match.matched >= 2;
    if (!isBack && !identifiedByCount && expected < minConfidence) {
      return { identified: false, hint: lines.length < 5 ? 'searching' : 'moveCloser' };
    }
  }

  // ── Chip key ────────────────────────────────────────────────────────────
  // Firing before the MRZ validates means the chip step has to scan the same
  // document a second time, which is the whole reason this gate exists.
  // Front only: the strip cannot appear on the back.
  if (!isBack && requireValidMrz && !hasValidMrz && !mrzAlreadyCaptured) {
    // The document is identified; only the strip is missing. "Move closer"
    // would push the user to crop it off entirely.
    return { identified: false, hint: 'showMrz' };
  }

  return { identified: true, hint: 'holdStill' };
}
