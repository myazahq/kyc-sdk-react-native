// ---------------------------------------------------------------------------
// useLiveness — the liveness state machine, as a React hook.
//
// RN mirror of the Flutter SDK's LivenessNotifier (liveness_provider.dart). It
// consumes per-frame `LivenessFaceData` (pushed in from the VisionCamera frame
// processor via runOnJS) and drives the phase machine:
//
//   loading → positioning → challenge → challenge_passed → capturing → complete
//                                 └────────────────────────▶ failed (timeout|face_lost)
//
// All gesture thresholds + guards come from the pure helpers
// (gestureDetector.ts / challengeManager.ts) and match Flutter's native-signal
// values — NOT the web SDK's landmark math. Guards mirrored 1:1 from Flutter:
//   • single-face enforcement (pause on faceCount > 1)
//   • face positioning (too far <0.2 / too close >0.7 of frame)
//   • lighting gate (challenges won't start while lighting is poor)
//   • per-challenge timeout, inter-challenge cooldown, wrong-gesture flash
//
// The hook is detector-agnostic: it just receives face data. The camera/frame-
// processor lives in LivenessStep; auto-capture + upload are owned there too.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CHALLENGE_POOL,
  DEFAULT_LIVENESS_CONFIG,
  FACE_TOO_CLOSE_RATIO,
  FACE_TOO_FAR_RATIO,
  type LivenessChallenge,
  type LivenessConfig,
  type LivenessFaceData,
  type LivenessFailureReason,
  type LivenessPhase,
} from './types';
import {
  detectBlink,
  detectNod,
  detectSmile,
  detectTurn,
  eyeAverageOpenProbability,
  pushHistory,
} from './gestureDetector';
import { ChallengeTracker, pickChallenges } from './challengeManager';
import { LivenessSpeaker } from './speech';
import type { VoiceGuidanceOption } from '../types/config';

const CHALLENGE_PASSED_MS = 700; // brief "Great!" before the next challenge
const POSITION_TOO_FAR = 'too_far';
const POSITION_TOO_CLOSE = 'too_close';
const MULTIPLE_FACES_GUIDANCE = 'Make sure only your face is visible';

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
}

export interface UseLivenessReturn extends LivenessUiState {
  /** Push a face frame into the machine (call from the frame processor via runOnJS). */
  onFace: (data: LivenessFaceData) => void;
  /** Push a "no face this frame" signal. */
  onNoFace: () => void;
  /** Feed live lighting quality (null = ok). */
  setLighting: (guidance: LightingGuidance | null) => void;
  /** Mark the selfie captured → phase `complete`. */
  markComplete: () => void;
  /** Restart the session with a fresh random challenge set. */
  reset: () => void;
  /** True while the machine wants a still captured (phase === 'capturing'). */
  shouldCapture: boolean;
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

function isTerminal(phase: LivenessPhase): boolean {
  return phase === 'complete' || phase === 'failed';
}

export function useLiveness(opts: UseLivenessOptions = {}): UseLivenessReturn {
  const { config, voiceGuidance, onReadyToCapture } = opts;

  // Resolve the challenge set once per session (and on reset).
  const trackerRef = useRef<ChallengeTracker | null>(null);
  if (trackerRef.current === null) {
    trackerRef.current = new ChallengeTracker(pickChallenges(config));
  }
  const initialTotalCount = trackerRef.current.totalCount;

  const speakerRef = useRef<LivenessSpeaker | null>(null);
  if (speakerRef.current === null) speakerRef.current = new LivenessSpeaker(voiceGuidance);

  // Gesture history windows (nod pitch, avg eye-open) + per-challenge guards.
  const xHistoryRef = useRef<number[]>([]);
  const earHistoryRef = useRef<number[]>([]);
  const processingRef = useRef(false); // true between pass and next-challenge start
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const passTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyFiredRef = useRef(false);

  const [state, setState] = useState<LivenessUiState>(() => ({
    phase: 'positioning',
    instruction: 'Position your face in the circle',
    activeChallenge: null,
    timeoutRemaining: 0,
    completedCount: 0,
    totalCount: initialTotalCount,
    positionGuidance: null,
    lightingGuidance: null,
    multipleFaces: false,
    wrongGesture: false,
    faceDetected: false,
    failureReason: null,
  }));

  // Keep a ref mirror so frame callbacks read fresh state without re-subscribing.
  const stateRef = useRef(state);
  stateRef.current = state;

  const speak = useCallback((text: string) => speakerRef.current?.speak(text), []);

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (seconds: number) => {
      cancelTimer();
      let remaining = seconds;
      timerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          cancelTimer();
          setState((s) =>
            isTerminal(s.phase)
              ? s
              : { ...s, phase: 'failed', failureReason: 'timeout', instruction: 'Time ran out' },
          );
        } else {
          setState((s) => (s.phase === 'challenge' ? { ...s, timeoutRemaining: remaining } : s));
        }
      }, 1000);
    },
    [cancelTimer],
  );

  const startNextChallenge = useCallback(() => {
    const tracker = trackerRef.current!;
    const current = tracker.current;
    if (!current) {
      // No challenges left → ask for a still.
      cancelTimer();
      setState((s) => ({
        ...s,
        phase: 'capturing',
        instruction: 'Hold still…',
        activeChallenge: null,
        positionGuidance: null,
      }));
      return;
    }
    xHistoryRef.current = [];
    earHistoryRef.current = [];
    processingRef.current = false;
    const timeout = config?.timeoutPerChallenge ?? current.config.timeoutSeconds;
    setState((s) => ({
      ...s,
      phase: 'challenge',
      instruction: current.config.instruction,
      activeChallenge: current.config.type,
      timeoutRemaining: timeout,
      positionGuidance: null,
      wrongGesture: false,
    }));
    speak(current.config.instruction);
    startTimer(timeout);
  }, [cancelTimer, config, speak, startTimer]);

  const onChallengePassed = useCallback(() => {
    processingRef.current = true;
    cancelTimer();
    trackerRef.current!.markCurrentPassed();
    trackerRef.current!.advance();
    setState((s) => ({
      ...s,
      phase: 'challenge_passed',
      instruction: 'Great!',
      completedCount: s.completedCount + 1,
      timeoutRemaining: 0,
      positionGuidance: null,
      wrongGesture: false,
    }));
    speak('Great');
    passTimeoutRef.current = setTimeout(() => {
      if (stateRef.current.phase !== 'challenge_passed') return;
      startNextChallenge();
    }, CHALLENGE_PASSED_MS);
  }, [cancelTimer, speak, startNextChallenge]);

  // ── Position check (every frame; mirrors Flutter _checkFacePosition) ────────
  const checkPosition = useCallback((ratio: number) => {
    setState((s) => {
      if (
        s.phase === 'challenge_passed' ||
        s.phase === 'capturing' ||
        isTerminal(s.phase)
      ) {
        return s;
      }
      let next: PositionGuidance | null;
      if (ratio < FACE_TOO_FAR_RATIO) next = POSITION_TOO_FAR;
      else if (ratio > FACE_TOO_CLOSE_RATIO) next = POSITION_TOO_CLOSE;
      else next = null;
      return next === s.positionGuidance ? s : { ...s, positionGuidance: next };
    });
  }, []);

  // ── Per-frame entry point ──────────────────────────────────────────────────
  const onFace = useCallback(
    (data: LivenessFaceData) => {
      const phase = stateRef.current.phase;
      if (isTerminal(phase)) return;

      if (!stateRef.current.faceDetected) {
        setState((s) => ({ ...s, faceDetected: true }));
      }

      // Multiple-faces guard — pause everything until a single face returns.
      if (data.faceCount > 1) {
        if (!stateRef.current.multipleFaces && phase !== 'capturing') {
          cancelTimer();
          setState((s) => ({
            ...s,
            multipleFaces: true,
            instruction: MULTIPLE_FACES_GUIDANCE,
            wrongGesture: false,
          }));
          speak(MULTIPLE_FACES_GUIDANCE);
        }
        return;
      }
      if (stateRef.current.multipleFaces) {
        // Single face restored — resume the current challenge timer.
        const resume = stateRef.current.phase === 'challenge';
        setState((s) => ({ ...s, multipleFaces: false }));
        if (resume) {
          const current = trackerRef.current!.current;
          if (current) {
            xHistoryRef.current = [];
            earHistoryRef.current = [];
            processingRef.current = false;
            const timeout = config?.timeoutPerChallenge ?? current.config.timeoutSeconds;
            setState((s) => ({ ...s, instruction: current.config.instruction }));
            startTimer(timeout);
          }
        }
      }

      checkPosition(data.faceSizeRatio);

      const s = stateRef.current;
      if (s.phase === 'positioning') {
        // Advance only at the right distance AND with acceptable lighting.
        if (s.positionGuidance == null && s.lightingGuidance == null) {
          startNextChallenge();
        } else if (s.positionGuidance) {
          speak(positionGuidanceText(s.positionGuidance));
        }
        return;
      }

      if (s.phase === 'challenge') {
        if (processingRef.current) return;
        if (s.positionGuidance != null) {
          // Gesture detection is unreliable at the wrong distance — also tell the
          // user to move closer/further (deduped by the speaker), matching Flutter
          // which speaks position guidance whenever it changes, in any phase.
          speak(positionGuidanceText(s.positionGuidance));
          return;
        }
        // Block gestures from passing in poor light — the native signals are noisy
        // when it's too dark/bright, so a gesture must not register (and the selfie
        // must not auto-capture) until the user is in good lighting. The banner
        // already tells them to fix it.
        if (s.lightingGuidance != null) {
          // Reset the gesture windows so a half-formed gesture from the dark frames
          // can't complete the instant lighting recovers.
          xHistoryRef.current = [];
          earHistoryRef.current = [];
          return;
        }
        // Update history windows.
        xHistoryRef.current = pushHistory(xHistoryRef.current, data.headEulerAngleX);
        earHistoryRef.current = pushHistory(earHistoryRef.current, eyeAverageOpenProbability(data));
        checkGesture(data);
      }
    },
    // checkGesture is defined below and stable via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cancelTimer, checkPosition, config, speak, startNextChallenge, startTimer],
  );

  // checkGesture reads the current challenge + histories from refs.
  const checkGesture = useCallback(
    (data: LivenessFaceData) => {
      const current = trackerRef.current!.current;
      if (!current) return;
      const type = current.config.type;
      // The iOS Vision pitch is a landmark proxy that gets contaminated when the
      // head turns (turning shifts the nose-vs-eyeline geometry and reads as a
      // nod). Reject nod while the head is meaningfully turned so a turn can't
      // false-trigger a nod. (Android ML Kit pitch is robust; this guard is
      // harmless there.)
      const detected =
        type === 'nod'
          ? detectNod(xHistoryRef.current) && Math.abs(data.headEulerAngleY) < 18
          : type === 'turn'
            ? detectTurn(data.headEulerAngleY)
            : type === 'blink'
              ? detectBlink(earHistoryRef.current)
              : detectSmile(data.smilingProbability);

      if (detected) {
        onChallengePassed();
        return;
      }

      // Wrong-gesture feedback — user is clearly doing a DIFFERENT gesture.
      const isTurning = detectTurn(data.headEulerAngleY);
      const isSmiling = detectSmile(data.smilingProbability);
      const wrong =
        type === 'nod'
          ? isTurning || isSmiling
          : type === 'turn'
            ? isSmiling
            : type === 'blink'
              ? isTurning || isSmiling
              : isTurning;
      if (wrong !== stateRef.current.wrongGesture) {
        setState((s) => ({ ...s, wrongGesture: wrong }));
      }
    },
    [onChallengePassed],
  );

  const onNoFace = useCallback(() => {
    if (!stateRef.current.faceDetected) return;
    if (isTerminal(stateRef.current.phase)) return;
    setState((s) => ({ ...s, faceDetected: false, positionGuidance: null, multipleFaces: false }));
  }, []);

  const setLighting = useCallback(
    (guidance: LightingGuidance | null) => {
      const prev = stateRef.current.lightingGuidance;
      const phase = stateRef.current.phase;
      setState((s) => {
        if (guidance === s.lightingGuidance) return s;
        // Lighting only matters before/while reaching capture.
        if (s.phase === 'capturing' || isTerminal(s.phase)) {
          return s.lightingGuidance != null ? { ...s, lightingGuidance: null } : s;
        }
        return { ...s, lightingGuidance: guidance };
      });
      // During a challenge, pause the per-challenge timer while lighting is poor so
      // the user isn't timed out while moving to better light, and resume when it
      // recovers (mirrors the multi-face pause). Gestures themselves are blocked in
      // the onFace handler until lighting is good. Banner only — not spoken.
      if (phase === 'challenge') {
        if (guidance != null && prev == null) {
          cancelTimer();
        } else if (guidance == null && prev != null) {
          const current = trackerRef.current?.current;
          if (current) {
            xHistoryRef.current = [];
            earHistoryRef.current = [];
            startTimer(config?.timeoutPerChallenge ?? current.config.timeoutSeconds);
          }
        }
      }
    },
    [cancelTimer, startTimer, config],
  );

  const markComplete = useCallback(() => {
    if (stateRef.current.phase !== 'capturing') return;
    cancelTimer();
    setState((s) => ({
      ...s,
      phase: 'complete',
      instruction: 'Verification complete',
      activeChallenge: null,
      positionGuidance: null,
    }));
  }, [cancelTimer]);

  const reset = useCallback(() => {
    cancelTimer();
    if (passTimeoutRef.current) clearTimeout(passTimeoutRef.current);
    trackerRef.current = new ChallengeTracker(pickChallenges(config));
    xHistoryRef.current = [];
    earHistoryRef.current = [];
    processingRef.current = false;
    readyFiredRef.current = false;
    speakerRef.current?.reset();
    setState({
      phase: 'positioning',
      instruction: 'Position your face in the circle',
      activeChallenge: null,
      timeoutRemaining: 0,
      completedCount: 0,
      totalCount: trackerRef.current.totalCount,
      positionGuidance: null,
      lightingGuidance: null,
      multipleFaces: false,
      wrongGesture: false,
      faceDetected: false,
      failureReason: null,
    });
  }, [cancelTimer, config]);

  // Fire onReadyToCapture once when we enter `capturing`.
  useEffect(() => {
    if (state.phase === 'capturing' && !readyFiredRef.current) {
      readyFiredRef.current = true;
      onReadyToCapture?.();
    }
  }, [state.phase, onReadyToCapture]);

  // Cleanup timers + speech on unmount.
  useEffect(() => {
    return () => {
      cancelTimer();
      if (passTimeoutRef.current) clearTimeout(passTimeoutRef.current);
      speakerRef.current?.stop();
    };
  }, [cancelTimer]);

  return useMemo(
    () => ({
      ...state,
      onFace,
      onNoFace,
      setLighting,
      markComplete,
      reset,
      shouldCapture: state.phase === 'capturing',
    }),
    [state, onFace, onNoFace, setLighting, markComplete, reset],
  );
}

// Re-export the challenge pool so the avatar/UI can label upcoming gestures.
export { CHALLENGE_POOL, DEFAULT_LIVENESS_CONFIG };
