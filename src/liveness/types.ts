// ---------------------------------------------------------------------------
// Liveness challenge types, state machine, and the per-frame face signal.
//
// Mirrors the Flutter SDK's `liveness_types.dart` + the `LivenessFaceData` value
// object. The RN SDK consumes the SAME native signals as Flutter (head euler
// angles + smile/eye probabilities from Apple Vision / ML Kit) — NOT the web
// SDK's MediaPipe landmarks — so the gesture thresholds match Flutter's.
// ---------------------------------------------------------------------------

import { defaultText } from '../i18n/translate';
import type { TextFn } from '../i18n/types';

export type LivenessChallenge =
  | 'nod'
  | 'turn'
  | 'blink'
  | 'smile'
  // Passive Liveness: hold still and look at the camera. Passes on its own
  // after a steady moment; the server's liveness model does the judging.
  | 'hold';

/** A challenge the avatar can demonstrate (the passive hold has no gesture). */
export type GestureChallenge = Exclude<LivenessChallenge, 'hold'>;

/** The catalogue key of each challenge's instruction (shown AND spoken). */
export const CHALLENGE_TEXT_KEYS: Record<LivenessChallenge, string> = {
  nod: 'presence.challenge.nod',
  turn: 'presence.challenge.turn',
  blink: 'presence.challenge.blink',
  smile: 'presence.challenge.smile',
  hold: 'presence.challenge.hold',
};

/** A challenge's instruction in the workflow's copy; the defaults without a `t`. */
export function challengeInstruction(type: LivenessChallenge, t: TextFn = defaultText): string {
  return t(CHALLENGE_TEXT_KEYS[type]);
}

/** The positioning prompt, in the workflow's copy. */
export function placeFaceInstruction(t: TextFn = defaultText): string {
  return t('presence.position.placeFace');
}

export interface ChallengeConfig {
  type: LivenessChallenge;
  instruction: string;
  timeoutSeconds: number;
}

/** Default challenge pool — same instructions/timeouts as the Flutter + web SDKs. */
export const CHALLENGE_POOL: ChallengeConfig[] = [
  { type: 'nod', instruction: challengeInstruction('nod'), timeoutSeconds: 8 },
  { type: 'turn', instruction: challengeInstruction('turn'), timeoutSeconds: 8 },
  { type: 'blink', instruction: challengeInstruction('blink'), timeoutSeconds: 6 },
  { type: 'smile', instruction: challengeInstruction('smile'), timeoutSeconds: 6 },
];

/**
 * Passive Liveness: the ONE prompt. The face holds still in the circle for
 * `HOLD_MS` (see holdDetector.ts); the recording and the selfie go to the
 * server, where the liveness model decides. Never part of the gesture pool.
 */
export const HOLD_CHALLENGE: ChallengeConfig = {
  type: 'hold',
  instruction: challengeInstruction('hold'),
  timeoutSeconds: 10,
};

// ---------------------------------------------------------------------------
// State machine (mirrors Flutter's LivenessPhase)
// ---------------------------------------------------------------------------

export type LivenessPhase =
  | 'loading' // Initializing camera + detector
  | 'positioning' // "Position your face in the circle"
  | 'challenge' // Active gesture challenge
  | 'challenge_passed' // Brief green flash
  // Screen-reflection liveness: the display emits a randomised colour sequence
  // and the camera watches the face reflect it. Runs as the FINAL challenge, so
  // by the time it starts the face is already positioned and steady.
  | 'flash'
  | 'capturing' // Auto-capturing selfie
  | 'complete' // All done — selfie review
  | 'failed'; // Timeout or face lost

export type LivenessFailureReason =
  | 'timeout'
  | 'face_lost'
  | 'no_camera'
  | 'load_error'
  /**
   * A different face appeared mid-session. Liveness proves a live human
   * performed the challenges; only continuity ties that human to the one being
   * captured. Matches the web SDK's `face_swap`.
   */
  | 'face_swap'
  /** The flash was measured and did not match the colours emitted. Matches the web SDK. */
  | 'flash_failed';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LivenessConfig {
  challengeCount: 2 | 3;
  challengePool?: LivenessChallenge[];
  timeoutPerChallenge: number;
  positioningTimeout: number;
  /**
   * Which liveness method runs. 'gestures' (default) is the randomised head
   * movements; 'flash' is screen reflection; 'both' runs gestures then flash,
   * because each catches what the other misses — gestures defeat a static
   * photo, flash defeats a replayed video. 'passive' asks for no gesture at
   * all: the face holds still while the clip records and the server's
   * liveness model decides.
   */
  mode?: LivenessMode;
  /** Colours in the flash sequence (2–5, default 4). Flash modes only. */
  flashSequenceLength?: number;
}

export type LivenessMode = 'gestures' | 'flash' | 'both' | 'passive';

export const DEFAULT_LIVENESS_CONFIG: LivenessConfig = {
  challengeCount: 2,
  timeoutPerChallenge: 8,
  positioningTimeout: 15,
  mode: 'gestures',
};

// ---------------------------------------------------------------------------
// LivenessFaceData — per-frame signals from the native detector (both platforms)
// ---------------------------------------------------------------------------

/**
 * A snapshot of the face attributes from a single camera frame. Intentionally
 * free of any ML Kit / Vision dependency so the gesture logic stays pure and
 * unit-testable. The native VisionCamera frame-processor plugin produces this:
 * Apple Vision on iOS, Google ML Kit on Android.
 */
export interface LivenessFaceData {
  /** Head pitch (degrees): positive = up, negative = down. Drives nod detection. */
  headEulerAngleX: number;
  /** Head yaw (degrees): positive = left, negative = right. Drives turn detection. */
  headEulerAngleY: number;
  /** Head roll/tilt (degrees). Available but unused for gesture detection. */
  headEulerAngleZ: number;
  /** 0.0 (not smiling) → 1.0 (smiling). */
  smilingProbability: number;
  /** 0.0 (closed) → 1.0 (open). */
  leftEyeOpenProbability: number;
  /** 0.0 (closed) → 1.0 (open). */
  rightEyeOpenProbability: number;
  /** Face width / frame width (0–1): <0.2 too far, >0.7 too close. */
  faceSizeRatio: number;
  /** # faces in frame. `> 1` pauses challenges. Defaults to 1 for older plugins. */
  faceCount: number;
  /** Mean frame luma (0–255). Feeds the low-light gate (<62 dark, >200 bright). */
  brightness: number;
  /**
   * Face centre in normalised frame coordinates (0–1), when the detector
   * reports it. Together with {@link faceSizeRatio} this is what distinguishes
   * "the same face moved" from "a different face appeared" — size alone cannot,
   * since two people at the same distance measure alike.
   */
  faceCenterX?: number;
  faceCenterY?: number;
  /**
   * ML Kit's per-face tracking id (Android only; absent on iOS, whose Vision
   * framework has no cross-frame equivalent). When present a CHANGE is proof of
   * a different face — which is why it supplements the geometric continuity
   * guard rather than being relied on alone.
   */
  trackingId?: number;
  /**
   * Mean RGB of the face region (0–255 each), for flash liveness. Absent when
   * the platform could not sample it — flash then degrades to inconclusive,
   * which fails soft, rather than to a wrong verdict.
   */
  faceRgb?: readonly [number, number, number];
}

/** Convenience: average of both eye-open probabilities. */
export function eyeAverageOpenProbability(face: LivenessFaceData): number {
  return (face.leftEyeOpenProbability + face.rightEyeOpenProbability) / 2;
}

// ---------------------------------------------------------------------------
// Face positioning thresholds (distance), mirroring Flutter
// ---------------------------------------------------------------------------

export const FACE_TOO_FAR_RATIO = 0.2;
export const FACE_TOO_CLOSE_RATIO = 0.7;
