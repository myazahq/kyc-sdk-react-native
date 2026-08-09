import type {
  LivenessChallenge,
  LivenessConfig,
  LivenessFaceData,
  LivenessFailureReason,
  LivenessPhase,
} from './types';
import type { FlashResult } from './flashDetector';

// ---------------------------------------------------------------------------
// The liveness machine's vocabulary: its UI state, its options, its guidance
// strings and the two phase predicates the handlers branch on.
//
// Split out of useLiveness (200-line rule). Deliberately free of the hook, so
// the phase predicates below can be read — and reasoned about — without the
// state machine around them. They are load-bearing: `isSettled` decides where
// guidance is suppressed, and getting its scope wrong is what once left the
// flash and the capture without a multiple-face check.
// ---------------------------------------------------------------------------

export const INTEGRITY_FAILED_PATCH = {
  phase: 'failed' as const,
  failureReason: 'face_swap' as const,
  instruction: 'Let\u2019s start over \u2014 please stay in frame.',
  activeChallenge: null,
  positionGuidance: null,
};

import { LivenessSpeaker } from './speech';
import type { VoiceGuidanceOption } from '../types/config';

export const CHALLENGE_PASSED_MS = 700; // brief "Great!" before the next challenge
export const POSITION_TOO_FAR = 'too_far';
export const POSITION_TOO_CLOSE = 'too_close';
export const MULTIPLE_FACES_GUIDANCE = 'Make sure only your face is visible';

export type PositionGuidance = typeof POSITION_TOO_FAR | typeof POSITION_TOO_CLOSE;
export type LightingGuidance = 'dark' | 'bright';

export interface LivenessUiState {
  phase: LivenessPhase;
  instruction: string;
  activeChallenge: LivenessChallenge | null;
  timeoutRemaining: number;
  completedCount: number;
  totalCount: number;
  positionGuidance: PositionGuidance | null;
  lightingGuidance: LightingGuidance | null;
  multipleFaces: boolean;
  wrongGesture: boolean;
  faceDetected: boolean;
  failureReason: LivenessFailureReason | null;
}

export interface UseLivenessOptions {
  config?: Partial<LivenessConfig>;
  voiceGuidance?: VoiceGuidanceOption;
  /** Fires once when all challenges pass and the phase enters `capturing`. */
  onReadyToCapture?: () => void;
  /**
   * Whether the step is actually on screen and the user has started.
   *
   * The machine is constructed while the readiness primer is still up — hooks
   * cannot be called conditionally — so without this it announces "Position
   * your face in the circle" to someone still reading the primer, before they
   * have tapped anything. Guidance for a screen the user cannot see is worse
   * than none: it is a voice from nowhere.
   *
   * Defaults true so a consumer that never sets it behaves as before.
   */
  announce?: boolean;
}

export interface UseLivenessReturn extends LivenessUiState {
  /** Push a face frame into the machine (call from the frame processor via runOnJS). */
  onFace: (data: LivenessFaceData) => void;
  /** Push a "no face this frame" signal. */
  onNoFace: () => void;
  /**
   * Resolves true once a face is detected AFTER the call, or false on timeout.
   * The capture gate uses this so an empty frame is never photographed.
   */
  awaitFreshFace: (timeoutMs: number) => Promise<boolean>;
  /** Feed live lighting quality (null = ok). */
  setLighting: (guidance: LightingGuidance | null) => void;
  /** Mark the selfie captured → phase `complete`. */
  markComplete: () => void;
  /** Restart the session with a fresh random challenge set. */
  reset: () => void;
  /** True while the machine wants a still captured (phase === 'capturing'). */
  shouldCapture: boolean;
  /** True while the screen should be running the flash sequence. */
  shouldFlash: boolean;
  /** Called by the screen when the flash sequence finishes. */
  completeFlash: (result: FlashResult) => void;
  /** The flash verdict, once run — carried into the submission as context. */
  flashResult: FlashResult | null;
  /** How many face discontinuities the continuity guard saw this session. */
  faceGlitches: number;
  /**
   * True once the session can no longer vouch for who is in frame. The capture
   * path reads this AFTER the still is taken: a substitution detected during
   * `capturing` is recorded silently (so nothing re-lays out mid-capture) and
   * acted on here.
   */
  integrityBroken: boolean;
  /** Live read of the integrity flag — see `isCompromised` in the hook. */
  isCompromised: () => boolean;
  /** Surfaces a failure that was detected mid-capture and deliberately held. */
  reportIntegrityFailure: () => void;
}

/** Position guidance text (spoken + shown), matching the Flutter SDK exactly. */
export function positionGuidanceText(g: PositionGuidance): string {
  return g === POSITION_TOO_FAR ? 'Kindly move closer' : 'Kindly move further away';
}
/** Lighting warning banner text — the full Flutter strings (shown, not spoken). */
export function lightingGuidanceText(g: LightingGuidance): string {
  return g === 'dark'
    ? 'It looks dark here. Move to a brighter area or near a light source for better detection.'
    : 'Too bright — reduce glare or move away from direct light for better detection.';
}

/**
 * Phases during which the screen must NOT change layout.
 *
 * While capturing, a re-layout moves the subject mid-shutter. While flashing,
 * the overlay's cutout is measured once when the flash starts, so shifting the
 * preview underneath it leaves the hole in the wrong place — the exact bug the
 * Flutter SDK hit. Guidance banners are also meaningless during a flash, since
 * the screen is deliberately painting the "wrong" light.
 */
export function isSettled(phase: LivenessPhase): boolean {
  return phase === 'capturing' || phase === 'flash';
}

export function isTerminal(phase: LivenessPhase): boolean {
  return phase === 'complete' || phase === 'failed';
}
