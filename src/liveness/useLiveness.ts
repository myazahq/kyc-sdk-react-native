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
import { ChallengeTracker, modeRunsGestures, pickChallenges } from './challengeManager';
import { FlashReadyGate } from './flashReadyGate';
import { FaceContinuityGuard } from './faceContinuity';
import type { FlashResult } from './flashDetector';
import { useFlashPhase } from './useFlashPhase';

// State shape, options, guidance strings and phase predicates live in
// ./livenessState — re-exported here so existing imports keep working.
export {
  positionGuidanceText,
  lightingGuidanceText,
  type PositionGuidance,
  type LightingGuidance,
  type LivenessUiState,
  type UseLivenessOptions,
  type UseLivenessReturn,
} from './livenessState';
import { LivenessSpeaker } from './speech';
import {
  INTEGRITY_FAILED_PATCH,
  CHALLENGE_PASSED_MS,
  POSITION_TOO_FAR,
  POSITION_TOO_CLOSE,
  MULTIPLE_FACES_GUIDANCE,
  isSettled,
  isTerminal,
  positionGuidanceText,
  type LightingGuidance,
  type PositionGuidance,
  type LivenessUiState,
  type UseLivenessOptions,
  type UseLivenessReturn,
} from './livenessState';

export function useLiveness(opts: UseLivenessOptions = {}): UseLivenessReturn {
  const { config, voiceGuidance, onReadyToCapture, announce = true } = opts;

  // Resolve the challenge set once per session (and on reset).
  const trackerRef = useRef<ChallengeTracker | null>(null);

  // Tracks that the face performing the challenges is the face still in frame.
  // Liveness without it proves a live human was present, not WHICH human.
  const continuityRef = useRef<FaceContinuityGuard>(new FaceContinuityGuard());
  // Flash-only has no challenges to act as a buffer, so it needs its own
  // "framed, lit and held still" gate before the screen lights up.
  const flashGateRef = useRef<FlashReadyGate | null>(null);
  // "No lighting warning" is ambiguous until the sampler has actually reported:
  // during warm-up, unknown looks identical to good.
  const lightingSampledRef = useRef(false);
  // When a face was last actually seen. The capture gate needs this to refuse a
  // frame with nobody in it.
  const lastFaceSeenRef = useRef<number | null>(null);

  // Set when the session can no longer vouch for who is in frame. Recorded
  // rather than shown during `capturing`: that phase runs the capture (and, in
  // future, the flash overlay), and re-laying out the screen mid-capture is how
  // the Flutter SDK ended up displacing its preview from the flash cutout.
  const integrityBrokenRef = useRef(false);
  if (trackerRef.current === null) {
    trackerRef.current = new ChallengeTracker(pickChallenges(config));
    flashGateRef.current = modeRunsGestures(config?.mode) ? null : new FlashReadyGate();
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

  const flash = useFlashPhase(config?.mode, setState);

  // Speak whatever the screen is currently instructing.
  //
  // Only CHALLENGE instructions were ever spoken, so a flash-only flow — which
  // has no challenges — was silent from start to finish, and "Position your face
  // in the circle" was never spoken in any mode. The guidance is most needed
  // exactly where it was missing: a user holding a phone at arm's length during
  // a flash sequence is not reading the screen.
  //
  // Keyed on the instruction rather than the phase so a challenge-to-challenge
  // change is announced too. The speaker de-dupes consecutive identical phrases,
  // so this cannot stutter over a re-render. Multi-face and lighting prompts are
  // spoken by their own handlers and take priority, so they are skipped here.
  useEffect(() => {
    if (!announce || !state.instruction || state.multipleFaces) return;
    speak(state.instruction);
  }, [announce, state.instruction, state.multipleFaces, speak]);
  // Whether the flash occupies a slot in the progress indicator.
  const flashIsStep = config?.mode === 'flash' || config?.mode === 'both';

  const startNextChallenge = useCallback(() => {
    const tracker = trackerRef.current!;
    const current = tracker.current;
    if (!current) {
      cancelTimer();
      // Flash runs LAST, after the gestures: by now the face is positioned and
      // steady, which is what makes the reflection readable. Starting it during
      // positioning would measure a moving target.
      if (flash.pending()) {
        setState((s) => ({
          ...s,
          phase: 'flash',
          instruction: 'Hold still and look at the screen',
          activeChallenge: null,
          positionGuidance: null,
        }));
        return;
      }
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
      if (s.phase === 'challenge_passed' || isSettled(s.phase) || isTerminal(s.phase)) {
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
  /**
   * A different face is in frame, or one returned after an absence.
   *
   * `substituted` ends the session: nothing performed so far can be attributed
   * to whoever is there now. `reacquired` is not proof — people look away — but
   * nothing vouches for the returning face either, so the challenges are
   * restarted rather than inherited.
   *
   * Mid-capture the verdict is RECORDED, not shown: re-laying out the screen
   * while a capture (or flash overlay) is running is a separate class of bug,
   * so the flow reports it once capture is done.
   */
  const onFaceIntegrityBroken = useCallback(
    (kind: 'substituted' | 'reacquired') => {
      const phase = stateRef.current.phase;
      if (isTerminal(phase)) return;
      integrityBrokenRef.current = true;
      // Counted whether or not it is shown: a session with several
      // discontinuities is worth flagging even when each one was recoverable.
      flash.recordGlitch();
      if (isSettled(phase)) return;

      cancelTimer();
      if (kind === 'substituted') {
        setState((s) => ({ ...s, ...INTEGRITY_FAILED_PATCH }));
        return;
      }

      // Re-acquired: start again from positioning with a fresh challenge set.
      trackerRef.current = new ChallengeTracker(pickChallenges(config));
      // The returning face has to earn the hold again — otherwise a face that
      // left and came back would flash immediately on a gate that is still
      // holding the departed face's dwell.
      flashGateRef.current?.reset();
      xHistoryRef.current = [];
      earHistoryRef.current = [];
      processingRef.current = false;
      integrityBrokenRef.current = false;
      setState((s) => ({
        ...s,
        phase: 'positioning',
        instruction: 'Position your face in the circle',
        activeChallenge: null,
        completedCount: 0,
        positionGuidance: null,
      }));
    },
    [cancelTimer, config, flash],
  );

  const onFace = useCallback(
    (data: LivenessFaceData) => {
      const phase = stateRef.current.phase;
      if (isTerminal(phase)) return;

      lastFaceSeenRef.current = Date.now();

      if (!stateRef.current.faceDetected) {
        setState((s) => ({ ...s, faceDetected: true }));
      }

      // Multiple-faces guard — pause everything until a single face returns.
      //
      // Runs in EVERY non-terminal phase, including the flash and the capture
      // itself. It used to be suppressed once the phase had settled, to keep
      // the layout still underneath the flash's cutout — but that put the blind
      // spot exactly where it matters most: the flash IS the liveness
      // measurement, and the capture is the frame that becomes the selfie, so a
      // second face arriving during either went unrecorded. A misaligned hole
      // is a cosmetic defect; an unnoticed second face is the thing the check
      // exists to catch. Flutter has never gated this either.
      //
      // The layout concern is handled where it belongs — the banner is
      // suppressed at RENDER time during a flash, so the state is still true
      // while nothing moves.
      if (data.faceCount > 1) {
        if (isSettled(phase)) {
          // The flash and the shutter are the two moments that actually prove
          // liveness. There is no useful guidance to show mid-sequence, so
          // instead of prompting, the session is marked BROKEN — the flash
          // aborts and the capture refuses. Flagging without breaking is what
          // made a second face during the flash have no effect at all.
          integrityBrokenRef.current = true;
        }
        if (!stateRef.current.multipleFaces) {
          cancelTimer();
          setState((s) => ({
            ...s,
            multipleFaces: true,
            instruction: isSettled(s.phase) ? s.instruction : MULTIPLE_FACES_GUIDANCE,
            wrongGesture: false,
          }));
          if (!isSettled(phase)) speak(MULTIPLE_FACES_GUIDANCE);
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

      // Same face as a moment ago? Nothing here identifies anyone — it only
      // rejects a substitution, which is what stops one person performing the
      // challenges while another is photographed.
      const continuity = continuityRef.current.update(data, Date.now());
      if (continuity === 'substituted' || continuity === 'reacquired') {
        onFaceIntegrityBroken(continuity);
        return;
      }

      checkPosition(data.faceSizeRatio);

      const s = stateRef.current;
      if (s.phase === 'positioning') {
        const gate = flashGateRef.current;
        if (gate) {
          // Flash-only. Advancing on a single good frame meant the screen
          // flashed at a face that was merely passing through the right
          // distance, before the "come closer / more light" guidance had any
          // chance to show — and before lighting had actually been measured.
          // Gestures don't need this because they take seconds and re-check
          // framing throughout; nothing follows the flash, so it does.
          const verdict = gate.update({
            framed: s.positionGuidance == null,
            lit: s.lightingGuidance == null,
            lightingConfirmed: lightingSampledRef.current,
            now: Date.now(),
          });
          if (s.positionGuidance) speak(positionGuidanceText(s.positionGuidance));
          if (verdict.ready) startNextChallenge();
          return;
        }
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
    [cancelTimer, checkPosition, config, onFaceIntegrityBroken, speak, startNextChallenge, startTimer],
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

  /**
   * Waits for a face detection that lands AFTER this call, up to `timeoutMs`.
   *
   * Deliberately not a recency check on the last-seen timestamp: a stamp from
   * just before the face left still falls inside any short window, and that is
   * exactly the blank-selfie case — the flash finishes, nobody is there, and the
   * shutter fires on an empty frame anyway. Demanding a NEW detection, with the
   * overlay gone and detection reliable again, means the face has to be there
   * now rather than have been there a moment ago.
   */
  const awaitFreshFace = useCallback(async (timeoutMs: number): Promise<boolean> => {
    const since = Date.now();
    const deadline = since + timeoutMs;
    while (Date.now() < deadline) {
      const seen = lastFaceSeenRef.current;
      if (seen !== null && seen > since) return true;
      await new Promise((r) => setTimeout(r, 60));
    }
    return false;
  }, []);

  const onNoFace = useCallback(() => {
    continuityRef.current.reportNoFace();
    if (!stateRef.current.faceDetected) return;
    if (isTerminal(stateRef.current.phase)) return;
    setState((s) => ({ ...s, faceDetected: false, positionGuidance: null, multipleFaces: false }));
  }, []);

  const setLighting = useCallback(
    (guidance: LightingGuidance | null) => {
      // The sampler has produced a real reading — "no warning" now means
      // measured-OK rather than not-yet-known.
      lightingSampledRef.current = true;
      const prev = stateRef.current.lightingGuidance;
      const phase = stateRef.current.phase;
      setState((s) => {
        if (guidance === s.lightingGuidance) return s;
        // Lighting only matters before/while reaching capture.
        if (isSettled(s.phase) || isTerminal(s.phase)) {
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
      instruction: 'Capture complete',
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
    // A retry is a fresh session: whoever is in frame now becomes the reference.
    continuityRef.current.reset();
    flashGateRef.current?.reset();
    lastFaceSeenRef.current = null;
    integrityBrokenRef.current = false;
    // A retry runs the whole check again, INCLUDING a fresh colour sequence —
    // reusing the previous one would hand an attacker the answer.
    flash.reset();
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

  /**
   * Surfaces a failure detected during `capturing` and deliberately withheld.
   *
   * Called by the capture path once the still is done, so the re-layout happens
   * against a settled screen. The Flutter SDK learned this the hard way: failing
   * mid-capture moved the preview circle out from under the flash overlay's
   * cutout, which is measured once when the flash starts.
   */
  const reportIntegrityFailure = useCallback(() => {
    if (!integrityBrokenRef.current) return;
    if (stateRef.current.phase === 'complete') return;
    cancelTimer();
    setState((s) => ({ ...s, ...INTEGRITY_FAILED_PATCH }));
  }, [cancelTimer]);

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
      awaitFreshFace,
      setLighting,
      markComplete,
      reset,
      shouldCapture: state.phase === 'capturing',
      shouldFlash: state.phase === 'flash',
      completeFlash: flash.complete,
      flashResult: flash.result(),
      faceGlitches: flash.glitches(),
      // The flash IS a step, so it gets a dot. Without this the indicator
      // claimed the check was finished while the longest, most visible part of
      // it was still to come — and in flash-only mode it showed no steps at all.
      totalCount: state.totalCount + (flashIsStep ? 1 : 0),
      completedCount: state.completedCount + (flashIsStep && flash.result() !== null ? 1 : 0),
      integrityBroken: integrityBrokenRef.current,
      // Read through a function, not a snapshot: integrity is recorded in a ref
      // (deliberately — re-laying out mid-flash is its own class of bug), and a
      // ref write does not re-render. Anything consulting it from a callback
      // created BEFORE the flash would otherwise read the pre-flash value, which
      // is precisely the window a substitution happens in.
      isCompromised: () => integrityBrokenRef.current,
      reportIntegrityFailure,
    }),
    [state, onFace, onNoFace, awaitFreshFace, setLighting, markComplete, reset, reportIntegrityFailure, flash],
  );
}

// Re-export the challenge pool so the avatar/UI can label upcoming gestures.
export { CHALLENGE_POOL, DEFAULT_LIVENESS_CONFIG };
