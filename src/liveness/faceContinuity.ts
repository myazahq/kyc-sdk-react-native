import type { LivenessFaceData } from './types';

// ─── Face continuity ──────────────────────────────────────────────────────────
//
// "Is this the same face it was a moment ago?"
//
// Liveness proves a live human performed the challenges. It proves nothing about
// WHO unless the face that performed them is the face that gets captured —
// otherwise one person can nod and blink while another is photographed, and
// every gesture check passes on the wrong person.
//
// Nothing here identifies anyone. It tracks whether the face in frame is
// CONTINUOUS with the one before it, which is all that is needed to reject a
// substitution:
//
//   • a jump — the face leaps across the frame or changes size abruptly. Real
//     heads move continuously at 15–30fps; a cut to another person does not.
//   • a gap — the face left and a different one arrived. After a loss nothing
//     vouches that the returning face is the same person, so progress earned
//     before the gap is not carried across it.
//   • a changed tracking id, where the platform provides one (Android ML Kit;
//     Apple Vision has no cross-frame equivalent). Proof rather than inference,
//     so it is used when present and never depended upon.
//
// Ported from the Flutter SDK's lib/src/liveness/face_continuity.dart — same
// thresholds, same reasoning. Pure logic, so the thresholds are testable.

export type FaceContinuity =
  /** Same face, still tracked. */
  | 'same'
  /**
   * A different face. The session cannot carry on: whoever performed the
   * challenges is not who is in frame now.
   */
  | 'substituted'
  /**
   * The face returned after being absent. Not proof of substitution — people
   * look away — but nothing vouches for it either, so anything already earned
   * must be re-earned.
   */
  | 'reacquired';

export interface FaceContinuityOptions {
  /**
   * How far the face centre may travel between consecutive frames, as a share
   * of the frame. Generous: at 15fps a real head covers ground, and the cost of
   * a false positive is a user being told to start again.
   */
  maxCentreJump?: number;
  /**
   * Largest allowed frame-to-frame change in face size, as a ratio. A face that
   * suddenly measures 1.6× its previous size is a different face, not someone
   * leaning in.
   */
  maxSizeRatioChange?: number;
  /**
   * A gap longer than this means the returning face is unvouched for. Short
   * enough to catch a camera pan between two people, long enough to survive the
   * dropped frames a colour flash causes.
   */
  maxGapMs?: number;
}

export class FaceContinuityGuard {
  private readonly maxCentreJump: number;
  private readonly maxSizeRatioChange: number;
  private readonly maxGapMs: number;

  private centreX: number | null = null;
  private centreY: number | null = null;
  private size: number | null = null;
  private trackingId: number | null = null;
  private lastSeen: number | null = null;

  constructor(options: FaceContinuityOptions = {}) {
    this.maxCentreJump = options.maxCentreJump ?? 0.35;
    this.maxSizeRatioChange = options.maxSizeRatioChange ?? 1.6;
    this.maxGapMs = options.maxGapMs ?? 900;
  }

  /**
   * Forget everything — call when the flow restarts and the previous face is no
   * longer the reference.
   */
  reset(): void {
    this.centreX = null;
    this.centreY = null;
    this.size = null;
    this.trackingId = null;
    this.lastSeen = null;
  }

  /**
   * Records that no face was visible. The stored position is KEPT: it is the
   * comparison point for whatever comes back, and it is `lastSeen` ageing that
   * turns an absence into a gap.
   */
  reportNoFace(): void {}

  /** Feeds a frame and reports what it means for continuity. */
  update(data: LivenessFaceData, nowMs: number): FaceContinuity {
    const lastSeen = this.lastSeen;
    const prevX = this.centreX;
    const prevY = this.centreY;
    const prevSize = this.size;
    const prevTrack = this.trackingId;

    this.lastSeen = nowMs;
    this.centreX = data.faceCenterX ?? null;
    this.centreY = data.faceCenterY ?? null;
    this.size = data.faceSizeRatio;
    if (data.trackingId != null && data.trackingId >= 0) {
      this.trackingId = data.trackingId;
    }

    // Nothing to compare against yet.
    if (lastSeen === null) return 'same';

    // A tracking id that changed is proof, where the platform offers one.
    if (
      prevTrack != null &&
      data.trackingId != null &&
      data.trackingId >= 0 &&
      data.trackingId !== prevTrack
    ) {
      return 'substituted';
    }

    // A gap: the face was away long enough that nothing vouches for its return.
    if (nowMs - lastSeen > this.maxGapMs) return 'reacquired';

    // A jump: continuous frames, discontinuous face.
    if (
      prevX != null &&
      prevY != null &&
      data.faceCenterX != null &&
      data.faceCenterY != null
    ) {
      const dx = Math.abs(data.faceCenterX - prevX);
      const dy = Math.abs(data.faceCenterY - prevY);
      if (dx > this.maxCentreJump || dy > this.maxCentreJump) return 'substituted';
    }

    if (prevSize != null && prevSize > 0.01 && data.faceSizeRatio > 0.01) {
      const ratio = data.faceSizeRatio / prevSize;
      if (ratio > this.maxSizeRatioChange || ratio < 1 / this.maxSizeRatioChange) {
        return 'substituted';
      }
    }

    return 'same';
  }
}
