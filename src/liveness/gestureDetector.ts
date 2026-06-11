// ---------------------------------------------------------------------------
// Gesture detection — pure functions over native face signals.
//
// Direct port of the Flutter SDK's gesture functions (face_detection.dart). They
// operate on `LivenessFaceData`-derived histories (degrees / probabilities), so
// the thresholds match Flutter's on-device-tuned values — NOT the web SDK's
// normalized-landmark thresholds. Kept pure so they unit-test without a camera.
//
// Histories are sliding windows (~20 frames) maintained by the liveness store.
// ---------------------------------------------------------------------------

/**
 * Detects a nod: `headEulerAngleX` (pitch) dips below −10° then recovers above
 * −5°. The caller maintains `xHistory` as a sliding window. ≥2 frames required.
 */
export function detectNod(xHistory: readonly number[]): boolean {
  if (xHistory.length < 2) return false;
  const minAngle = Math.min(...xHistory);
  const currentAngle = xHistory[xHistory.length - 1]!;
  return minAngle < -10 && currentAngle > -5;
}

/** Detects a head turn when `headEulerAngleY` (yaw) exceeds ±25°. Single frame. */
export function detectTurn(eulerY: number): boolean {
  return Math.abs(eulerY) > 25;
}

/**
 * Detects a blink: the average eye-open probability drops below 0.2 then
 * recovers above 0.5. ≥2 frames required. (Threshold relaxed 0.15→0.2 from
 * on-device data, where a real blink only briefly bottoms out.)
 */
export function detectBlink(earHistory: readonly number[]): boolean {
  if (earHistory.length < 2) return false;
  const hadClose = earHistory.some((v) => v < 0.2);
  const recovered = earHistory[earHistory.length - 1]! > 0.5;
  return hadClose && recovered;
}

/** Detects a smile when `smilingProbability` exceeds 0.5. Single frame. */
export function detectSmile(smilingProbability: number): boolean {
  return smilingProbability > 0.5;
}

import type { LivenessChallenge, LivenessFaceData } from './types';
import { eyeAverageOpenProbability } from './types';

/**
 * Evaluates whether the given challenge passes for the current frame/history.
 * `xHistory` is the pitch window (nod); `earHistory` is the avg-eye-open window
 * (blink). Single-frame gestures (turn/smile) read the latest `face`.
 */
export function evaluateChallenge(
  challenge: LivenessChallenge,
  face: LivenessFaceData,
  xHistory: readonly number[],
  earHistory: readonly number[],
): boolean {
  switch (challenge) {
    case 'nod':
      return detectNod(xHistory);
    case 'turn':
      return detectTurn(face.headEulerAngleY);
    case 'blink':
      return detectBlink(earHistory);
    case 'smile':
      return detectSmile(face.smilingProbability);
    default:
      return false;
  }
}

/** Appends to a sliding window, trimming to `maxLen` (default 20 frames). */
export function pushHistory(history: number[], value: number, maxLen = 20): number[] {
  const next = [...history, value];
  return next.length > maxLen ? next.slice(next.length - maxLen) : next;
}

/** Re-export so callers can read the eye-open average without reaching into types. */
export { eyeAverageOpenProbability };
