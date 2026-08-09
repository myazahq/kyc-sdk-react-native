import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Easing, Image, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput,
  useVideoOutput,
} from 'react-native-vision-camera';
import { runOnJS } from 'react-native-worklets';

import { radius, spacing } from '../config/theme';
import { withRetry } from '../services/retry';
import { mapToKycError, safeReportError } from '../services/errors';
import { compressSelfieImage, compressVideo } from '../services/mediaCompress';
import { KYCError } from '../types/verification';
import { useStore } from 'zustand';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MyazaPulseLoader } from '../components/MyazaPulseLoader';
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
import { ReadyPrimer } from '../components/ReadyPrimer';
import { READY_LIVENESS } from '../components/readyPrimerContent';
import { LivenessAvatar } from './LivenessAvatar';
import { detectFaceOnFrame } from '../liveness/visionCameraFaceDetector';
import { buildLivenessIntegrity } from '../liveness/integritySignals';
import { DEFAULT_LIVENESS_CONFIG } from '../liveness/types';
import { useFlashSequence } from './useFlashSequence';
import { useFlashHole } from './useFlashHole';
import {
  FRESH_FACE_TIMEOUT_MS,
  INSTRUCTION_HEIGHT,
  LightingBanner,
  ProgressDots,
  SelfiePreview,
  StyleAbsFill,
  resolveGuidance,
  useSelfieUpload,
  LivenessComplete,
  LivenessFailed,
} from './liveness';
import {
  lightingGuidanceText,
  positionGuidanceText,
  useLiveness,
} from '../liveness/useLiveness';
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
// Title/description ("Face Verification" / "Follow the on-screen instructions")
// live in the SHEET HEADER (KycFlow); this body is the camera + guidance.
//
// Anti-spoofing: the selfie is AUTO-captured (never user-triggered) so a static
// image can't pass; challenges are randomized; lighting/single-face gates block
// auto-capture in poor conditions. (Brightness is gated server-side too; the
// client lighting hint here uses the native detector's presence as a proxy and
// is intentionally conservative — see the lighting note below.)

export function LivenessStep(): React.ReactElement {
  const { colors } = useTheme();
  const toast = useToast();
  const config = useKycConfig();
  const api = useKyc((s) => s.api);
  const setMediaId = useKyc((s) => s.setMediaId);
  const setCaptureIntegrity = useKyc((s) => s.setCaptureIntegrity);
  const nextStep = useKyc((s) => s.nextStep);

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
        new KYCError('camera_permission_denied', 'Camera access is required for the liveness check.'),
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

  // ── Liveness state machine ─────────────────────────────────────────────────
  // `handleCapture` is created after `liveness` (it calls liveness.markComplete),
  // so the machine gets it via a ref to avoid a definition cycle.
  const captureRef = useRef<() => void>(() => {});
  const liveness = useLiveness({
    voiceGuidance: config.voiceGuidance,
    // Silent until the primer is dismissed and the camera is actually up. The
    // machine is constructed behind the primer, so without this it talks to a
    // user who has not started yet.
    announce: ready && !showPrimer,
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
      // Recorded at capture, not at submit: by then the liveness hook is gone
      // and its flash result with it.
      setCaptureIntegrity({
        liveness: buildLivenessIntegrity(
          config.livenessMode ?? 'gestures',
          liveness.faceGlitches,
          liveness.flashResult,
        ),
      });
      liveness.markComplete();
      // Stop the liveness video (best-effort) and start the eager upload. The
      // recorder resolves the finished file path (or null if nothing recorded);
      // keep it so the review-screen retry can re-upload it.
      const videoPath = await videoRecorder.stop();
      videoPathRef.current = videoPath;
      void uploadSelfieAndVideo(compressed, videoPath);
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
  // A plain JS function the worklet hands the per-frame result to. It is wrapped
  // with `runOnJS(...)` INSIDE the worklet (the canonical react-native-worklets
  // pattern) rather than pre-wrapped — pre-wrapping produced a "non-worklet
  // function" error when called from the frame-processor worklet.
  // The most recent face-region RGB, for the flash sequence. A ref rather than
  // state: this updates every frame, and re-rendering the camera preview at
  // frame rate would be both wasteful and — during a flash — actively harmful,
  // since the overlay's cutout is measured once.
  const faceRgbRef = useRef<readonly [number, number, number] | null>(null);

  const handleFace = useCallback((data: LivenessFaceData | null) => {
    const l = livenessRef.current;
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
  }, []);


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
  });

  // Published to the sheet root rather than drawn in this step: an overlay here
  // lights only the padded body, and the screen IS the light source. The sheet
  // root is still the SAME tree as the preview, so the cutout and the preview
  // scale together under any UIKit transform.
  const flashStore = useKycStore();
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
      frame.dispose();
      runOnJS(handleFace)(face);
    },
    // Dropped frames are expected here; swallow the per-drop log noise.
    onFrameDropped: () => {
      'worklet';
    },
  });

  // ── Error states ────────────────────────────────────────────────────────────
  if (cameraUnavailable) {
    return <CameraUnavailableView />;
  }
  // "Here's what happens next", BEFORE the OS prompt — and shown even when
  // permission is already granted, because it is about what the step will ask
  // of the user, not about access. Opening the camera unannounced is what makes
  // people fumble the first attempt.
  if (!ready) {
    return <ReadyPrimer content={READY_LIVENESS} onReady={() => setReady(true)} />;
  }
  if (showPrimer) {
    return <CameraPermissionPrimingView onGrant={() => setPerm('requesting')} />;
  }
  if (permissionDenied) {
    return <CameraPermissionView onRetry={() => setPerm('requesting')} />;
  }

  // ── Review (selfie captured) ─────────────────────────────────────────────────
  if (liveness.phase === 'complete' && selfieUri) {
    return (
      <LivenessComplete
        selfieUri={selfieUri}
        upload={upload}
        onRetake={() => {
          setSelfieUri(null);
          setUploadError(null);
          selfieIdRef.current = null;
          videoPathRef.current = null;
          liveness.reset();
        }}
        onContinue={nextStep}
      />
    );
  }

  if (liveness.phase === 'failed') {
    return <LivenessFailed reason={liveness.failureReason} onRetry={liveness.reset} />;
  }

  // ── Live camera (circular) + ring state machine + guidance ──────────────────
  // Mirrors the web/Flutter SDKs: a fixed circular preview with a thick,
  // colour-state ring, a dashed face-guide ellipse, and pass/capture flashes.
  const phase = liveness.phase;
  const hasWarning =
    liveness.wrongGesture ||
    liveness.multipleFaces ||
    liveness.positionGuidance != null ||
    liveness.lightingGuidance != null;
  const isCamLoading = phase === 'loading';

  const ringColor = isCamLoading
    ? colors.gray300
    : hasWarning
      ? colors.error
      : phase === 'challenge_passed' || phase === 'capturing'
        ? colors.success
        : phase === 'challenge'
          ? colors.warning
          : liveness.faceDetected
            ? colors.primary
            : colors.gray300;

  const guidance = resolveGuidance(liveness);
  const instrColor = isCamLoading
    ? colors.textMuted
    : guidance.tone === 'error'
      ? colors.error
      : phase === 'challenge_passed'
        ? colors.success
        : phase === 'challenge'
          ? colors.warning
          : colors.textDark;

  // Fixed circle, sized to fit the sheet width (caps at 300).
  const CIRCLE = Math.min(Dimensions.get('window').width - spacing.md * 4, 300);
  const lighting = liveness.lightingGuidance;

  // Rendered INSIDE the sheet, so the SDK header and the "powered by" footer
  // stay visible throughout — only the flash itself goes full-screen.
  return (
    <View style={{ alignItems: 'center', gap: spacing.md }}>
      {/* Instruction text — above the circle */}
      <MyazaText
        variant="heading3"
        style={{ textAlign: 'center', minHeight: INSTRUCTION_HEIGHT }}
        color={instrColor}
      >
        {phase === 'flash' ? '' : guidance.text}
      </MyazaText>

      {/* Circular camera with a thick colour-state ring */}
      <View
        ref={flashHoleRef}
        collapsable={false}
        style={{
          width: CIRCLE,
          height: CIRCLE,
          borderRadius: CIRCLE / 2,
          borderWidth: 4,
          borderColor: ringColor,
          overflow: 'hidden',
          backgroundColor: '#111111',
        }}
      >
        {device ? (
          <Camera
            style={{ flex: 1 }}
            device={device}
            isActive={perm === 'granted'}
            outputs={[photoOutput, videoOutput, frameOutput]}
            // Mirror the front-camera preview + capture so it reads like a
            // mirror (matches the web SDK's scaleX(-1) video).
            mirrorMode="on"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}

        {/* Dashed face-guide ellipse (taller than wide) */}
        <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width={CIRCLE} height={CIRCLE}>
          <Ellipse
            cx={CIRCLE / 2}
            cy={CIRCLE * 0.46}
            rx={CIRCLE * 0.3}
            ry={CIRCLE * 0.38}
            fill="none"
            stroke={colors.success}
            strokeWidth={2}
            strokeDasharray="8 5"
            opacity={liveness.faceDetected ? 0.8 : 0.4}
          />
        </Svg>

        {/* Loading overlay */}
        {isCamLoading ? (
          <View style={[StyleAbsFill, { backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }]}>
            <MyazaPulseLoader size={64} />
          </View>
        ) : null}

        {/* Challenge-passed flash — green wash + checkmark badge */}
        {phase === 'challenge_passed' ? (
          <View style={[StyleAbsFill, { backgroundColor: `${colors.success}33`, alignItems: 'center', justifyContent: 'center' }]}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={28} height={28} viewBox="0 0 24 24">
                <Path d="M5 13l4 4L19 7" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </View>
        ) : null}

        {/* Capturing flash — white wash + "Got it!" */}
        {phase === 'capturing' ? (
          <View style={[StyleAbsFill, { backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }]}>
            <MyazaText variant="heading3" color="#FFFFFF">Got it!</MyazaText>
          </View>
        ) : null}

        {/* Timeout countdown */}
        {phase === 'challenge' && liveness.timeoutRemaining > 0 ? (
          <View style={{ position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
            <MyazaText variant="bodySmall" color="#FFFFFF">{`${liveness.timeoutRemaining}s`}</MyazaText>
          </View>
        ) : null}
      </View>

      {/* Lighting warning banner — mirrors Flutter (amber-50/200/800 + lightbulb) */}
      {lighting ? <LightingBanner text={lightingGuidanceText(lighting)} /> : null}

      {/* Numbered progress dots with connectors */}
      <ProgressDots total={liveness.totalCount} completed={liveness.completedCount} active={phase === 'challenge' || phase === 'positioning' || phase === 'flash'} />

      {/* Gesture demo avatar */}
      {liveness.activeChallenge ? <LivenessAvatar challenge={liveness.activeChallenge} /> : null}
    </View>
  );
}
