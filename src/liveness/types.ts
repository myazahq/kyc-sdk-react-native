// ---------------------------------------------------------------------------
// Liveness challenge types, state machine, and the per-frame face signal.
//
// Mirrors the Flutter SDK's `liveness_types.dart` + the `LivenessFaceData` value
// object. The RN SDK consumes the SAME native signals as Flutter (head euler
// angles + smile/eye probabilities from Apple Vision / ML Kit) — NOT the web
// SDK's MediaPipe landmarks — so the gesture thresholds match Flutter's.
// ---------------------------------------------------------------------------

export type LivenessChallenge = 'nod' | 'turn' | 'blink' | 'smile';

export interface ChallengeConfig {
  type: LivenessChallenge;
  instruction: string;
  timeoutSeconds: number;
}

/** Default challenge pool — same instructions/timeouts as the Flutter + web SDKs. */
export const CHALLENGE_POOL: ChallengeConfig[] = [
  { type: 'nod', instruction: 'Kindly nod your head', timeoutSeconds: 8 },
  { type: 'turn', instruction: 'Kindly turn your head', timeoutSeconds: 8 },
  { type: 'blink', instruction: 'Blink your eyes', timeoutSeconds: 6 },
  { type: 'smile', instruction: 'Smile please', timeoutSeconds: 6 },
];

// ---------------------------------------------------------------------------
// State machine (mirrors Flutter's LivenessPhase)
// ---------------------------------------------------------------------------

export type LivenessPhase =
  | 'loading' // Initializing camera + detector
  | 'positioning' // "Position your face in the circle"
  | 'challenge' // Active gesture challenge
  | 'challenge_passed' // Brief green flash
  | 'capturing' // Auto-capturing selfie
  | 'complete' // All done — selfie review
  | 'failed'; // Timeout or face lost

export type LivenessFailureReason = 'timeout' | 'face_lost' | 'no_camera' | 'load_error';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LivenessConfig {
  challengeCount: 2 | 3;
  challengePool?: LivenessChallenge[];
  timeoutPerChallenge: number;
  positioningTimeout: number;
}

export const DEFAULT_LIVENESS_CONFIG: LivenessConfig = {
  challengeCount: 2,
  timeoutPerChallenge: 8,
  positioningTimeout: 15,
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
