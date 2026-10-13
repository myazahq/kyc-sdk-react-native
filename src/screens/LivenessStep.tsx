import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import {
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput,
  useVideoOutput,
} from 'react-native-vision-camera';
import { runOnJS } from 'react-native-worklets';

import { spacing } from '../config/theme';
import { withRetry } from '../services/retry';
import { mapToVerificationError, safeReportError } from '../services/errors';
import { compressSelfieImage, compressVideo } from '../services/mediaCompress';
import { isSelfieBlurry, measureSelfieSharpness } from '../lib/selfie-sharpness';
import { VerificationError } from '../types/verification';
import { useStore } from 'zustand';
import { useFlowState, useVerificationConfig, useVerificationStore, useTheme } from '../components/runtime';
import { useText } from '../i18n/useText';
import { UiText } from '../components/Typography';
import { UiButton } from '../components/UiButton';
import { UiPulseLoader } from '../components/UiPulseLoader';
import { useVideoRecorder } from '../components/useVideoRecorder';
import {
  LIVENESS_VIDEO_BITRATE,
  MAX_VIDEO_BYTES,
  SELFIE_SETTLE_MS,
  VIDEO_CAPTURE_RESOLUTION,
} from '../config/captureSettings';
import { Icon } from '../components/Icon';
import { useToast } from '../components/toast';
import { CameraPermissionView, CameraUnavailableView, CameraPermissionPrimingView } from '../components/CameraPermissionView';
import { useFaceModelReady } from '../liveness/useModelReady';
import { ReadyPrimer } from '../components/ReadyPrimer';
import { READY_LIVENESS, READY_LIVENESS_PASSIVE } from '../components/readyPrimerContent';
import { livenessLayout } from '../lib/livenessLayout';
import { detectFaceOnFrame } from '../liveness/visionCameraFaceDetector';
import { buildLivenessIntegrity } from '../liveness/integritySignals';
import { DEFAULT_LIVENESS_CONFIG } from '../liveness/types';
import { livenessProgress } from '../lib/captureRing';
import { useFlashSequence } from './useFlashSequence';
import { useFlashHole } from './useFlashHole';
import { useLivenessCameraOn } from './useLivenessCameraOn';
import { livenessCameraOnScreen } from '../lib/bright-screen';
import {
  FRESH_FACE_TIMEOUT_MS,
  SCAN_HOLD_MS,
  resolveGuidance,
  useSelfieUpload,
  LivenessComplete,
  LivenessHandover,
  livenessFailureMessage,
  LivenessLive,
  LivenessReview,
  useSelfieAutoAdvance,
} from './liveness';
import { faceWindowFor } from '../lib/faceWindow';
import { useSheetInsets } from '../components/sheetInsets';
import { livenessCutout, type Size, windowDrop } from '../lib/livenessCutout';
import { successHaptic, tapHaptic } from '../services/haptics';
import { showsSelfieReview } from '../config/biometricOptions';
import { useLiveness } from '../liveness/useLiveness';
import type { LivenessFaceData } from '../liveness/types';

// Liveness — the RN mirror of the Flutter/web liveness flow. A front-camera
// VisionCamera preview drives a frame processor that calls the native face
// detector ("detectFace": Apple Vision on iOS / Google ML Kit on Android). The
// per-frame signal is marshalled to JS (runOnJS) and fed to the `useLiveness`
// state machine (challenges, single-face + position + lighting guards, timeouts,
// wrong-gesture flash — all mirroring Flutter's LivenessNotifier). When every
// challenge passes, the SDK auto-captures a selfie + a short liveness video and
// uploads both eagerly (with retry) on the review screen — same as Flutter.
//
// Title/description live in the SHEET HEADER; this body is camera + guidance.
// Anti-spoofing: the selfie is AUTO-captured (never user-triggered) so a static
// image can't pass; challenges are randomized; lighting/single-face gates block
// auto-capture in poor conditions. (Brightness is gated server-side too; the
// client lighting hint here uses the native detector's presence as a proxy and
// is intentionally conservative — see the lighting note below.)

export function LivenessStep(): React.ReactElement {
  const { colors } = useTheme();
  const toast = useToast();
  const config = useVerificationConfig();
  const t = useText();
  const api = useFlowState((s) => s.api);
  const setMediaId = useFlowState((s) => s.setMediaId);
  const setCaptureIntegrity = useFlowState((s) => s.setCaptureIntegrity);
  const nextStep = useFlowState((s) => s.nextStep);
  const clearSelfie = useFlowState((s) => s.clearSelfie);

  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  // v5 capture is via output objects attached to <Camera outputs={[...]}> —
  // there is no camera ref / takePhoto(). Selfie → photoOutput.capturePhotoToFile;
  // liveness video → videoOutput.createRecorder().startRecording(); face signals
  // → frameOutput's onFrame worklet.
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'balanced' });
  const videoOutput = useVideoOutput({
    enableAudio: false,
    fileType: 'mp4',
    targetBitRate: LIVENESS_VIDEO_BITRATE,
    targetResolution: VIDEO_CAPTURE_RESOLUTION,
    // iOS only honours targetBitRate/targetResolution on the AVAssetWriter
    // pipeline; without this it uses AVCaptureMovieFileOutput at full quality
    // (clips blew past the 25MB upload cap). This keeps the file small.
    enablePersistentRecorder: true,
  });
  const videoRecorder = useVideoRecorder(videoOutput, !!device);

  // 'priming' shows the "Allow camera access" screen BEFORE the OS prompt
  // (Stripe-style); the prompt only fires (→ 'requesting') once the user taps
  // "Grant access". `perm` is driven by the async requestPermission result, not
  // synchronously from `hasPermission` — otherwise the window while the OS prompt
  // is open (hasPermission still false) would read as "denied" and fire onError.
  const [perm, setPerm] = useState<'priming' | 'requesting' | 'granted' | 'denied'>(
    hasPermission ? 'granted' : 'priming',
  );

  // Android fetches the face model through Play Services rather than bundling
  // it, so it can be absent on a fresh install. Normally already 'ready' here —
  // the flow primes the download at open, behind consent and ID-type selection.
  const modelState = useFaceModelReady();
  const permReportedRef = useRef(false);

  // Camera-availability grace (a simulator has no front camera).
  const [cameraGrace, setCameraGrace] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCameraGrace(true), 1500);
    return () => clearTimeout(t);
  }, []);
  const cameraUnavailable = cameraGrace && !device;
  // Gate the whole camera path on the user acknowledging the primer.
  const [ready, setReady] = useState(false);
  const showPrimer = perm === 'priming' && !!device;
  const permissionDenied = perm === 'denied' && !!device;

  // Reflect an externally-granted permission.
  useEffect(() => {
    if (hasPermission) setPerm('granted');
  }, [hasPermission]);

  // Fire the real OS prompt only after the user taps "Grant access" (or retry).
  useEffect(() => {
    if (perm !== 'requesting') return;
    let cancelled = false;
    void (async () => {
      const granted = await requestPermission();
      if (!cancelled) setPerm(granted ? 'granted' : 'denied');
    })();
    return () => {
      cancelled = true;
    };
  }, [perm, requestPermission]);

  useEffect(() => {
    if (permissionDenied && !permReportedRef.current) {
      permReportedRef.current = true;
      safeReportError(
        config.onError,
        new VerificationError('camera_permission_denied', 'Camera access is required for the liveness check.'),
      );
    }
    if (!permissionDenied) permReportedRef.current = false;
  }, [permissionDenied, config.onError]);

  // Selfie + liveness-video upload (see ./liveness/useSelfieUpload).
  const upload = useSelfieUpload();
  const {
    selfieUri,
    setSelfieUri,
    uploading,
    retryInfo,
    uploadError,
    setUploadError,
    selfieIdRef,
    videoPathRef,
    uploadSelfieAndVideo,
  } = upload;

  // The still the review should flag as soft, held BY URI, so a measurement
  // that lands after a retake can never flag the next photo. A notice only,
  // never a gate: see lib/selfie-sharpness.
  const [softSelfieUri, setSoftSelfieUri] = useState<string | null>(null);

  // A stored selfie with no uploaded mediaId is an interrupted upload (failed,
  // or the user left mid-flight): resume it once on mount. Idempotent — with a
  // mediaId there is nothing to do.
  useEffect(() => {
    if (selfieUri && !selfieIdRef.current && !uploading && !uploadError) {
      void uploadSelfieAndVideo(selfieUri, videoPathRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Liveness state machine ─────────────────────────────────────────────────
  // `handleCapture` is created after `liveness` (it calls liveness.markComplete),
  // so the machine gets it via a ref to avoid a definition cycle.
  const captureRef = useRef<() => void>(() => {});
  const liveness = useLiveness({
    voiceGuidance: config.voiceGuidance,
    // Silent until the primer is dismissed and the camera is actually up: the
    // machine is built behind the primer and would talk to nobody.
    announce: ready && !showPrimer,
    t,
    onReadyToCapture: () => captureRef.current(),
    config: {
      ...DEFAULT_LIVENESS_CONFIG,
      mode: config.livenessMode ?? 'gestures',
      flashSequenceLength: config.flashSequenceLength,
    },
  });

  const handleCapture = useCallback(async () => {
    if (!device) {
      liveness.markComplete();
      return;
    }
    try {
      // Settle delay before the shutter: the final gesture (e.g. a head turn)
      // leaves the user still moving, so a brief pause lets them steady up for a
      // clean, non-blurred selfie. The "Kindly hold still…" prompt shows during it.
      await new Promise((r) => setTimeout(r, SELFIE_SETTLE_MS));
      // v5: capture the selfie via the photo output (no camera ref). filePath is
      // a plain fs path — prepend file:// for the uploader/compressor.
      // A different face appeared while the machine was in `capturing`. The
      // verdict was recorded rather than shown (nothing may re-lay out mid
      // capture), so it is acted on here — BEFORE the shutter, so no still of a
      // stranger is ever taken, let alone uploaded.
      // Live read. `liveness.integrityBroken` is a snapshot from the render
      // this callback was created in — i.e. from BEFORE the flash — so a face
      // swapped or added during the sequence was recorded and then never seen
      // here.
      if (liveness.isCompromised()) {
        liveness.reportIntegrityFailure();
        return;
      }
      // Nobody in frame? Do not photograph an empty room.
      //
      // The flash can leave the face briefly undetectable, so this waits for a
      // FRESH detection now that the overlay is gone rather than trusting a
      // timestamp from before it started — a stale stamp from just before the
      // user walked away passes any recency check, which is precisely how a
      // blank selfie got captured and submitted as a passing liveness result.
      //
      // Losing the face is not a failure, just an abandoned attempt: drop back
      // to positioning with the camera still running, so the user re-frames and
      // the gate fires again with no teardown and no permission re-prompt.
      if (!(await liveness.awaitFreshFace(FRESH_FACE_TIMEOUT_MS))) {
        liveness.reset();
        return;
      }
      const file = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
      const raw = `file://${file.filePath}`;
      const compressed = await compressSelfieImage(raw).catch(() => raw);
      setSelfieUri(compressed);
      // Measured on the still the applicant is about to see. It never holds
      // the review back: the notice appears when the answer does.
      void measureSelfieSharpness(compressed).then((score) => {
        if (isSelfieBlurry(score)) setSoftSelfieUri(compressed);
      });
      // Recorded at capture, not at submit: by then the liveness hook is gone
      // and its flash result with it.
      setCaptureIntegrity({
        liveness: buildLivenessIntegrity(
          liveness.effectiveMode,
          liveness.faceGlitches,
          liveness.flashResult,
          liveness.challenges,
        ),
      });
      liveness.markComplete();
      // Stop the liveness video (best-effort) and start the eager upload. The
      // recorder resolves the finished file path (or null if nothing recorded);
      // keep it so the review-screen retry can re-upload it.
      const videoPath = await videoRecorder.stop();
      videoPathRef.current = videoPath;
      void uploadSelfieAndVideo(compressed, videoPath, videoPath ? null : videoRecorder.failure());
    } catch {
      liveness.reset();
    }
  }, [device, liveness, uploadSelfieAndVideo, photoOutput, videoRecorder, setCaptureIntegrity, config.livenessMode]);

  useEffect(() => {
    captureRef.current = () => void handleCapture();
  }, [handleCapture]);

  // Record a short liveness video across the challenge phases (best-effort).
  useEffect(() => {
    if (liveness.phase === 'positioning' || liveness.phase === 'challenge') {
      videoRecorder.start();
    }
  }, [liveness.phase, videoRecorder]);

  // ── Frame output: native face detect → runOnJS into the state machine ───────
  // `liveness` changes each render; keep it in a ref so the (stable) JS handler
  // always reads the latest state-machine callbacks.
  const livenessRef = useRef(liveness);
  livenessRef.current = liveness;

  // The circle and the gesture avatar are sized from the WINDOW, not the width
  // alone, so a short phone keeps the avatar on screen (lib/livenessLayout).
  // A hook, so it lives up here with the ring refs, above the gates below.
  const windowSize = useWindowDimensions();
  const layout = livenessLayout(windowSize);

  // Progress for the ring, read every frame from a ref — never from render.
  // Declared HERE, above the early returns below: a hook after a conditional
  // return renders "more hooks than during the previous render" the moment the
  // gate dismisses, which is exactly what the ready primer does on its way out.
  const phaseStartedRef = useRef(Date.now());
  const phaseKeyRef = useRef(`${liveness.phase}:${liveness.completedCount}`);
  const phaseKey = `${liveness.phase}:${liveness.completedCount}`;
  if (phaseKeyRef.current !== phaseKey) {
    phaseKeyRef.current = phaseKey;
    phaseStartedRef.current = Date.now();
  }
  const timeoutRef = useRef(
    liveness.timeoutRemaining || DEFAULT_LIVENESS_CONFIG.timeoutPerChallenge,
  );
  if (liveness.phase === 'challenge' && liveness.timeoutRemaining > timeoutRef.current) {
    timeoutRef.current = liveness.timeoutRemaining;
  }
  const getRingTarget = useCallback(() => {
    const l = livenessRef.current;
    return livenessProgress({
      phase: l.phase,
      completedCount: l.completedCount,
      totalCount: l.totalCount,
      elapsedInPhase: (Date.now() - phaseStartedRef.current) / 1000,
      challengeTimeout: timeoutRef.current,
    });
  }, []);

  // The selfie URI lands BEFORE the machine reaches `complete` (capture →
  // compress → setSelfieUri → markComplete), and the review is gated on that
  // URI — so the camera circle used to unmount on the very frame the ring's
  // target reached the end: the close, the green, the shutter, none of it
  // was ever seen. Hold the frame for the closing beat, then hand over.
  const [closeSeen, setCloseSeen] = useState(false);
  useEffect(() => {
    if (liveness.phase !== 'complete') return;
    // The shutter, then the scan down the window (liveness/LivenessWindow).
    const t = setTimeout(() => setCloseSeen(true), SCAN_HOLD_MS);
    return () => clearTimeout(t);
  }, [liveness.phase]);
  const holdingForClose =
    (liveness.phase === 'capturing' || liveness.phase === 'complete') && !closeSeen;
  // The biometric scopes skip the review by default: hand over the moment the
  // ring has closed, WITHOUT waiting for the upload (see LivenessHandover).
  // The upload reports to the store and the submitted step waits on it, so
  // the person sees one loading screen rather than one per step. A restored
  // selfie (media id, no local file) is ready at once; an upload that already
  // failed keeps the review, whose Try Again is the recovery.
  const selfieReview = showsSelfieReview(config);
  // The step was OPENED with its selfie already taken: the person came back
  // to it, or resumed a session past it. It then says so and offers Continue;
  // it never hands forward by itself and never runs the check again.
  const arrivedDone = useRef(Boolean(selfieUri) || Boolean(selfieIdRef.current)).current;
  useSelfieAutoAdvance({
    enabled: !selfieReview && !arrivedDone,
    ready: (!!selfieUri || !!selfieIdRef.current) && !holdingForClose && !uploadError,
    onAdvance: nextStep,
  });
  // The live camera is what this render shows: past the "I'm ready" primer,
  // the permission primer and the model, not failed, not yet on the review.
  const cameraOnScreen = livenessCameraOnScreen({
    hasDevice: !!device,
    permission: perm,
    ready,
    modelState,
    phase: liveness.phase,
    onReview: !!(selfieIdRef.current || (selfieUri && !holdingForClose)),
  });
  // Tells the sheet root the camera is on, so it lights the face from the
  // screen (components/BrightScreen: the light theme and full brightness).
  // Latched from the camera to the end of the step (the review stays lit);
  // the primers before it keep the organisation's normal theme.
  useLivenessCameraOn(cameraOnScreen);

  // ── Taking the whole sheet ─────────────────────────────────────────────────
  // The live camera has it, and so does the review that follows while there is
  // a photo to show. A check that fails stays on the camera too. Mirrors,
  // condition for condition, the early returns below: every other state of
  // this step (the primers, the errors, the hand-over, a restored selfie with
  // no photo) is an ordinary sheet screen.
  const reviewing = !!(selfieIdRef.current || (selfieUri && !holdingForClose));
  const handingOver = reviewing && !selfieReview && !uploadError && !arrivedDone;
  const liveCamera =
    !reviewing &&
    !cameraUnavailable &&
    modelState === 'ready' &&
    ready &&
    !showPrimer &&
    !permissionDenied;
  const wantsSheet = liveCamera || (reviewing && !handingOver && !!selfieUri);
  const setImmersiveCapture = useFlowState((s) => s.setImmersiveCapture);
  const handedOver = useFlowState((s) => s.immersiveCapture);
  useEffect(() => {
    setImmersiveCapture(wantsSheet);
  }, [wantsSheet, setImmersiveCapture]);
  // The sheet's size and the camera's go with it: in the sheet the circle
  // shows the whole frame, and the face is judged against that again.
  useEffect(() => {
    if (!liveCamera) liveness.setFaceWindow(null);
    else syncFaceWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCamera]);
  // A plain JS function the worklet hands the per-frame result to. It is wrapped
  // with `runOnJS(...)` INSIDE the worklet (the canonical react-native-worklets
  // pattern) rather than pre-wrapped — pre-wrapping produced a "non-worklet
  // function" error when called from the frame-processor worklet.
  // The most recent face-region RGB, for the flash sequence. A ref rather than
  // state: this updates every frame, and re-rendering the camera preview at
  // frame rate would be both wasteful and — during a flash — actively harmful,
  // since the overlay's cutout is measured once.
  const faceRgbRef = useRef<readonly [number, number, number] | null>(null);

  // ── The window the face is judged against ──────────────────────────────────
  // The full-screen camera shows only the middle of the frame, so the state
  // machine is told how much of the frame the window covers (lib/faceWindow).
  // Worked out from the box the camera is MEASURED at and the frame's own
  // shape, both of which arrive after the first render.
  const frameSizeRef = useRef<Size | null>(null);
  const frameAspectRef = useRef<number | null>(null);
  // The same top inset the frame places its window with (ImmersiveFrame).
  const topInset = useSheetInsets().top;
  const topInsetRef = useRef(topInset);
  topInsetRef.current = topInset;
  const syncFaceWindow = useCallback(() => {
    const frame = frameSizeRef.current;
    const aspect = frameAspectRef.current;
    // The camera fills the frame, cover-fit, and the window shows its middle.
    livenessRef.current.setFaceWindow(
      frame && aspect
        ? faceWindowFor({
            frame,
            window: livenessCutout(frame),
            frameAspect: aspect,
            drop: windowDrop(frame, livenessCutout(frame), topInsetRef.current),
          })
        : null,
    );
  }, []);
  const onFrameSize = useCallback(
    (size: Size) => {
      frameSizeRef.current = size;
      syncFaceWindow();
    },
    [syncFaceWindow],
  );

  // The room has read as dark since the camera opened. Latched: more of the
  // screen is then given to the light background, which brightens the face,
  // and a tint that followed the reading would drop again and flicker.
  const [dimRoom, setDimRoom] = useState(false);

  const handleFace = useCallback((data: LivenessFaceData | null, frameAspect?: number) => {
    const l = livenessRef.current;
    if (frameAspect && frameAspect !== frameAspectRef.current) {
      frameAspectRef.current = frameAspect;
      syncFaceWindow();
    }
    if (data && data.brightness < 62) setDimRoom(true);
    if (!data) {
      faceRgbRef.current = null;
      l.onNoFace();
      return;
    }
    faceRgbRef.current = data.faceRgb ?? null;
    // Low-light gate (thresholds mirror Flutter's _BrightnessSampler: <62 dark,
    // >200 bright). Feeds the lighting warning + speech and blocks challenges so
    // gestures don't misbehave in poor light.
    l.setLighting(data.brightness < 62 ? 'dark' : data.brightness > 200 ? 'bright' : null);
    if (data.faceCount > 0) l.onFace(data);
    else {
      faceRgbRef.current = null;
      l.onNoFace();
    }
  }, [syncFaceWindow]);

  // A tap in the hand for each step that lands, and a firmer one for the
  // photo: the screen is being looked at, not read.
  const hapticPhase = liveness.phase;
  useEffect(() => {
    if (hapticPhase === 'challenge_passed') tapHaptic();
    else if (hapticPhase === 'complete') successHaptic();
  }, [hapticPhase]);

  // Hoisted above this component's several early returns — it is a hook, and
  // calling it further down (next to the circle it measures, where it reads
  // better) would make it conditional on which branch rendered.
  const { ref: flashHoleRef, hole: flashHole } = useFlashHole(liveness.phase === 'flash');

  const { flashColor } = useFlashSequence({
    active: liveness.shouldFlash,
    // Stop painting the moment a second face appears or the face is swapped:
    // finishing the sequence would produce a reflection measurement for a face
    // that is no longer the subject.
    shouldContinue: () => !livenessRef.current.isCompromised(),
    sequenceLength: config.flashSequenceLength,
    readFaceRgb: () => faceRgbRef.current,
    onComplete: (result) => livenessRef.current.completeFlash(result),
    attempt: liveness.flashAttempt,
  });

  // Published to the sheet root rather than drawn in this step: an overlay here
  // lights only the padded body, and the screen IS the light source. The sheet
  // root is still the SAME tree as the preview, so the cutout and the preview
  // scale together under any UIKit transform.
  const flashStore = useVerificationStore();
  const setFlashPaint = useStore(flashStore, (st) => st.setFlashPaint);
  const isFlashing = liveness.phase === 'flash';
  useEffect(() => {
    setFlashPaint(isFlashing ? { color: flashColor, hole: flashHole } : null);
  }, [isFlashing, flashColor, flashHole, setFlashPaint]);
  // Clear on unmount so a colour can never outlive the step.
  useEffect(() => () => setFlashPaint(null), [setFlashPaint]);

  const frameOutput = useFrameOutput({
    // ML Kit (Android) and Apple Vision both consume YUV efficiently.
    pixelFormat: 'yuv',
    // Face detection (esp. Apple Vision) runs longer than one frame interval, so
    // skip incoming frames while the detector is busy instead of queuing them
    // late — keeps the pipeline smooth and quiets the "frame-was-late" drops.
    // Liveness gestures are slow, so a reduced effective rate is fine.
    dropFramesWhileBusy: true,
    onFrame: (frame) => {
      'worklet';
      const face = detectFaceOnFrame(frame);
      // Width over height, upright, whichever way the sensor delivers it.
      const aspect = Math.min(frame.width, frame.height) / Math.max(frame.width, frame.height);
      frame.dispose();
      runOnJS(handleFace)(face, aspect);
    },
    // Dropped frames are expected here; swallow the per-drop log noise.
    onFrameDropped: () => {
      'worklet';
    },
  });

  // ── Review (selfie already exists) ──────────────────────────────────────────
  // Checked BEFORE every capture-flow gate (ready primer, permission, model):
  // a selfie captured on an earlier visit — or a restored session where only
  // the uploaded mediaId survived — means there is nothing to capture, so the
  // step opens on review exactly as the document steps reopen on theirs.
  // A restored selfie (earlier visit) opens straight on review; the one being
  // captured RIGHT NOW waits for the ring to close first.
  if (selfieIdRef.current || (selfieUri && !holdingForClose)) {
    // Review hidden: the hook above advances on this render; the view is the
    // submitted step's own loading screen, so the hand-over is invisible. A
    // FAILED upload still gets the review, for its retry.
    if (!selfieReview && !uploadError && !arrivedDone) {
      return <LivenessHandover />;
    }
    const review = {
      soft: !!selfieUri && softSelfieUri === selfieUri,
      upload,
      done: arrivedDone && !selfieReview,
      onRetake: () => {
        setSelfieUri(null);
        setCloseSeen(false);
        setUploadError(null);
        selfieIdRef.current = null;
        videoPathRef.current = null;
        clearSelfie();
        liveness.reset();
      },
      onContinue: nextStep,
    };
    // With a photo to show, the review keeps the whole screen: the photo where
    // the camera was. A restored session has none and keeps the sheet.
    if (selfieUri) {
      return handedOver ? <LivenessReview selfieUri={selfieUri} {...review} /> : <View />;
    }
    return <LivenessComplete selfieUri={selfieUri} {...review} />;
  }

  // ── Error states ────────────────────────────────────────────────────────────
  if (cameraUnavailable) {
    return <CameraUnavailableView />;
  }
  // The face model is fetched on demand on Android (see useModelReady), so it
  // can be absent on a fresh install or a device without Play Services. Checked
  // here, before the camera opens, because detectFace reports a missing model
  // and an empty frame identically — gating on frames would leave the user on
  // "position your face" forever with nothing to explain it.
  if (modelState === 'unavailable') {
    return (
      <CameraUnavailableView
        message="Face verification couldn't start on this device. Check your connection and try again, or use a different device."
      />
    );
  }
  // "Here's what happens next", BEFORE the OS prompt — and shown even when
  // permission is already granted, because it is about what the step will ask
  // of the user, not about access. Opening the camera unannounced is what makes
  // people fumble the first attempt.
  if (!ready) {
    // Passive Liveness asks for no prompts, so its description says so.
    const primer = config.livenessMode === 'passive' ? READY_LIVENESS_PASSIVE : READY_LIVENESS;
    return <ReadyPrimer content={primer} onReady={() => setReady(true)} />;
  }
  if (showPrimer) {
    return <CameraPermissionPrimingView onGrant={() => setPerm('requesting')} />;
  }
  if (permissionDenied) {
    return <CameraPermissionView onRetry={() => setPerm('requesting')} />;
  }
  // The model is still arriving. Measured at ~9s on a freshly installed device
  // over fast wifi, and the connections this SDK actually serves are slower, so
  // the head start from opening the flow does not always win the race.
  //
  // Without this the camera opened anyway and `detectFace` returned
  // `faceCount: 0` for every frame, which is indistinguishable from "no face in
  // shot" — so the user was told to position a face that was never going to
  // register, for as long as the download took. That is the exact failure the
  // readiness gate exists to prevent, and MrzScanView already answers it this
  // way; only this screen was missing it.
  //
  // Deliberately AFTER the primer and the permission prompt: those need no
  // model, so letting them run first keeps the download overlapping something
  // the user is already reading. Only the camera itself waits.
  if (modelState === 'preparing') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <UiPulseLoader size={24} />
        <View style={{ height: spacing.md }} />
        <UiText variant="bodyMedium" style={{ textAlign: 'center' }}>
          Getting face verification ready. This only happens once.
        </UiText>
      </View>
    );
  }

  // ── The live camera, full screen ────────────────────────────────────────────
  // The camera sharp in a window for the face and blurred around it, the
  // progress line on the window's edge, the instruction above and the step
  // count below (see liveness/LivenessLive). Only the flash paints over all
  // of it. A failed check stays here, with its reason and Try Again.
  //
  // For the frame or two before the sheet has handed the screen over, this
  // still sits in the sheet's padded body, where a full-screen layout would
  // flash up at the wrong size; nothing is drawn until it has.
  if (!handedOver) return <View />;
  return (
    <LivenessLive
      liveness={liveness}
      guidance={resolveGuidance(liveness, t)}
      device={device}
      cameraActive={perm === 'granted'}
      outputs={[photoOutput, videoOutput, frameOutput]}
      getRingTarget={getRingTarget}
      windowRef={flashHoleRef}
      dimRoom={dimRoom}
      failure={
        liveness.phase === 'failed'
          ? { message: livenessFailureMessage(liveness.failureReason), onRetry: liveness.reset }
          : null
      }
      onFrameSize={onFrameSize}
    />
  );
}
