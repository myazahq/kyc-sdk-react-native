import type { LivenessFaceData } from './types';

// ---------------------------------------------------------------------------
// Passive Liveness: the hold prompt.
//
// The web SDK counts 60 consecutive in-position frames (about two seconds at
// 30 fps). The RN frame processor drops frames while the native detector is
// busy, so its rate varies by device and a frame count would mean a different
// length of time on every phone. The hold is timed instead: about two seconds
// of an unbroken, in-position face, restarted whenever the face leaves
// position (or the frame, or good light, or a second face appears).
// ---------------------------------------------------------------------------

/** About two seconds of a steady, centred face. */
export const HOLD_MS = 2000;

/**
 * How far the face centre may sit from the middle of the frame (normalised
 * 0–1 coordinates) and still count as centred. Matches the web SDK's 20%.
 */
export const HOLD_CENTRE_TOLERANCE = 0.2;

/**
 * Whether the face is centred in the frame. When the detector reports no
 * centre (older plugins), distance alone decides, as it does for positioning.
 */
export function faceCentred(face: Pick<LivenessFaceData, 'faceCenterX' | 'faceCenterY'>): boolean {
  const { faceCenterX: x, faceCenterY: y } = face;
  if (x == null || y == null) return true;
  return Math.abs(x - 0.5) <= HOLD_CENTRE_TOLERANCE && Math.abs(y - 0.5) <= HOLD_CENTRE_TOLERANCE;
}

/** Times one hold. `update` on each frame, `reset` whenever the face leaves position. */
export class HoldTimer {
  private since: number | null = null;

  constructor(private readonly holdMs: number = HOLD_MS) {}

  /** Record a frame; true once the face has held position for `holdMs`. */
  update(inPosition: boolean, now: number): boolean {
    if (!inPosition) {
      this.since = null;
      return false;
    }
    if (this.since === null) this.since = now;
    return now - this.since >= this.holdMs;
  }

  reset(): void {
    this.since = null;
  }
}
