import type { LivenessPhase } from '../liveness/types';

// The liveness ring's arithmetic — a MIRROR of the web SDK's
// components/CaptureRing.tsx and hooks/useLiveness.ts updateLivenessProgress
// (and of the Flutter SDK's liveness/capture_ring.dart). Change a rule in one
// and change it in all three in the same commit.
//
// Two numbers. The TARGET is where the test has actually got to and only ever
// moves forward. The DISPLAY eases toward it on real elapsed time, critically
// damped, so a gesture landing (a whole segment in one go) and the detector's
// own frame rate both arrive as motion rather than cuts.

/** Time constant of the display's approach, seconds. ~95% of a gap in three. */
export const TAU = 0.09;

/** How far a challenge segment may fill on its clock alone: time running out
 *  is not progress, so the clock never completes a segment — the gesture
 *  landing does. */
export const CHALLENGE_SEGMENT_CAP = 0.85;

/** The native still takes a beat after `capturing` begins; its segment fills
 *  across this window. It never CLOSES on it: the clock is capped like a
 *  challenge's, and only `complete` (the still in hand) reaches 1. On this
 *  SDK the still is settle → native photo → compress, seconds on a slow
 *  phone, and the ring used to sit closed for all of it. */
export const CAPTURE_WINDOW_SEC = 0.4;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : Number.isFinite(n) ? n : 0);

export function advanceTarget(target: number, real: number): number {
  return Math.max(target, clamp01(real));
}

export function easeToward(shown: number, target: number, dt: number): number {
  if (dt <= 0) return shown;
  return shown + (target - shown) * (1 - Math.exp(-dt / TAU));
}

export interface LivenessProgressInput {
  phase: LivenessPhase;
  /** Steps passed so far. On this SDK the count is bumped at
   *  `challenge_passed` — read off the hook, not assumed. */
  completedCount: number;
  /** Every step the user performs: the gestures, plus the flash when it runs. */
  totalCount: number;
  /** Seconds since the current phase began. */
  elapsedInPhase: number;
  /** The running challenge's timeout, seconds. */
  challengeTimeout: number;
}

/**
 * Where the WHOLE test has got to, 0..1, in equal segments: positioning, each
 * step, the capture. Each segment is measured by what actually gates it here —
 * this SDK advances out of positioning the instant the face is framed and lit
 * (no steady-frame counter), so that segment fills on the transition; a
 * challenge fills on its clock; the capture fills across the still's window.
 */
export function livenessProgress(s: LivenessProgressInput): number {
  const seg = 1 / (s.totalCount + 2);
  const done = s.completedCount; // steps whose segments are complete
  switch (s.phase) {
    case 'challenge':
    case 'flash':
      return seg * (1 + done + Math.min(CHALLENGE_SEGMENT_CAP, s.elapsedInPhase / Math.max(s.challengeTimeout, 1)));
    case 'challenge_passed':
      return seg * (1 + done + 0);
    case 'capturing':
      return seg * (1 + s.totalCount + Math.min(CHALLENGE_SEGMENT_CAP, s.elapsedInPhase / CAPTURE_WINDOW_SEC));
    case 'complete':
      return 1;
    default:
      return 0;
  }
}

/** Linear mix of two #rrggbb colours, for the close-to-green beat. */
export function mixHex(a: string, b: string, t: number): string {
  const k = clamp01(t);
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const out = [1, 3, 5].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}
