import {
  verifyDocumentIdentity,
  type DocumentGuidance,
  type DocumentHint,
} from './documentIdentity';

// ---------------------------------------------------------------------------
// Text-based auto-capture gate.
//
// Auto-capture rides on-device TEXT recognition — a KYC document is text-dense,
// and a check-digit-valid MRZ is an even stronger "framed & readable" signal.
// The recogniser is already in the build for the MRZ step, so this needs no new
// native code and works identically on both platforms.
//
// Three questions before firing:
//
//   • IDENTITY — is this the document the user picked? (documentIdentity.ts)
//   • FRAMING  — is it presented like a document? Measured from the region the
//     recognised text occupies, which is the only geometry text recognition
//     gives us. It is a proxy for the document's extent, not its edges, so the
//     thresholds are deliberately loose: they exist to reject text sprawling
//     across the whole frame (a screen, a page of prose) or a document too far
//     away to read — not to fine-tune composition.
//   • STABILITY — held steady for a dwell, so the shot isn't taken mid-move.
//     This is what stops the blurry captures that make auto-capture feel worse
//     than a manual shutter.
//
// Pure logic (no camera or ML dependency) so the thresholds are unit-tested
// rather than tuned by trial on a device. Ported from the Flutter SDK's
// document_text_gate.dart — keep the two in step.
// ---------------------------------------------------------------------------

/** Normalised (0..1) bounding box of all recognised text. */
export interface TextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextGateOptions {
  /** Minimum recognised text lines to treat the frame as showing a document. */
  minLines?: number;
  /** Smallest share of the frame the text region may cover. */
  minTextArea?: number;
  /** Largest share. Text over nearly the whole frame is a screen, not a card. */
  maxTextArea?: number;
  /** How far the text region's centre may sit from the frame's centre. */
  maxOffCentre?: number;
  /** How long the framing must hold before firing. */
  dwellMs?: number;
}

export interface UpdateOptions {
  country: string;
  idType: string;
  /** Which face is up. The back skips keyword identity — see documentIdentity. */
  side?: 'front' | 'back';
  bounds?: TextBounds | null;
  requireMrz?: boolean;
  hasValidMrz?: boolean;
  mrzAlreadyCaptured?: boolean;
  now?: number;
}

export class DocumentTextGate {
  private readonly minLines: number;
  private readonly minTextArea: number;
  private readonly maxTextArea: number;
  private readonly maxOffCentre: number;
  private readonly dwellMs: number;

  private heldSince: number | null = null;
  private fired = false;

  constructor(opts: TextGateOptions = {}) {
    this.minLines = opts.minLines ?? 5;
    this.minTextArea = opts.minTextArea ?? 0.06;
    this.maxTextArea = opts.maxTextArea ?? 0.82;
    this.maxOffCentre = opts.maxOffCentre ?? 0.3;
    this.dwellMs = opts.dwellMs ?? 700;
  }

  get hasFired(): boolean {
    return this.fired;
  }

  /** Progress through the stability dwell, 0..1 — drives the UI's scan ring. */
  progress(now: number): number {
    if (this.heldSince == null) return 0;
    if (this.dwellMs <= 0) return 1;
    return Math.min(1, Math.max(0, (now - this.heldSince) / this.dwellMs));
  }

  /** Feeds one frame's recognised `lines`. */
  update(lines: string[], o: UpdateOptions): DocumentGuidance {
    const now = o.now ?? Date.now();
    if (this.fired) return { framing: 'ready', hint: 'captured' };

    const identity = verifyDocumentIdentity(lines, {
      country: o.country,
      idType: o.idType,
      side: o.side ?? 'front',
      requireValidMrz: o.requireMrz ?? false,
      hasValidMrz: o.hasValidMrz ?? false,
      mrzAlreadyCaptured: o.mrzAlreadyCaptured ?? false,
    });
    if (!identity.identified) {
      this.heldSince = null;
      return {
        framing: identity.hint === 'wrongDocument' ? 'wrongShape' : 'none',
        hint: identity.hint,
      };
    }

    // A check-digit-valid MRZ read from THIS frame is conclusive: only a travel
    // document carries one, and it only validates when legible — so it proves
    // identity and readability at once, and the shot need not wait out a dwell.
    // (A merely STORED MRZ does not qualify — see `mrzAlreadyCaptured` — or
    // every retake would fire on its first frame.)
    if (o.hasValidMrz) {
      this.fired = true;
      return { framing: 'ready', hint: 'holdStill' };
    }

    const framingHint = this.framingProblem(o.bounds ?? null, lines.length, o.side ?? 'front');
    if (framingHint) {
      this.heldSince = null;
      return { framing: 'adjust', hint: framingHint };
    }

    if (this.heldSince == null) this.heldSince = now;
    if (now - this.heldSince >= this.dwellMs) {
      this.fired = true;
      return { framing: 'ready', hint: 'holdStill' };
    }
    return { framing: 'holding', hint: 'holdStill' };
  }

  /** Why the text region isn't acceptably framed, or null when it is. */
  private framingProblem(
    bounds: TextBounds | null,
    lineCount: number,
    side: 'front' | 'back',
  ): DocumentHint | null {
    // Card backs are text-SPARSE by design — a PVC's is mostly barcode with a
    // few small print lines — so the front's density thresholds would hold the
    // gate at "move closer" forever on a perfectly framed back. The rect
    // detector (where present) still guards the geometry.
    const minLines = side === 'back' ? Math.min(3, this.minLines) : this.minLines;
    const minTextArea = side === 'back' ? Math.min(0.03, this.minTextArea) : this.minTextArea;
    if (!bounds) {
      // No geometry from this platform — fall back to text density alone.
      return lineCount < minLines ? 'moveCloser' : null;
    }
    const area = Math.min(1, Math.max(0, bounds.width * bounds.height));
    if (area < minTextArea) return 'moveCloser';
    if (area > this.maxTextArea) return 'moveBack';

    const offCentreX = Math.abs(bounds.x + bounds.width / 2 - 0.5);
    const offCentreY = Math.abs(bounds.y + bounds.height / 2 - 0.5);
    if (offCentreX > this.maxOffCentre || offCentreY > this.maxOffCentre) return 'centre';
    return null;
  }

  /** Clears the latch so the next side (or a retake) starts a fresh dwell. */
  reset(): void {
    this.heldSince = null;
    this.fired = false;
  }
}
