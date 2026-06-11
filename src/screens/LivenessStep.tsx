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
import { useKyc, useKycConfig, useTheme } from '../components/runtime';
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
import { CameraPermissionView, CameraUnavailableView } from '../components/CameraPermissionView';
import { LivenessAvatar } from './LivenessAvatar';
import { detectFaceOnFrame } from '../liveness/visionCameraFaceDetector';
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

  const [perm, setPerm] = useState<'checking' | 'granted' | 'denied'>(
    hasPermission ? 'granted' : 'checking',
  );
  const askedRef = useRef(false);
  const permReportedRef = useRef(false);

  // Camera-availability grace (a simulator has no front camera).
  const [cameraGrace, setCameraGrace] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCameraGrace(true), 1500);
    return () => clearTimeout(t);
  }, []);
  const cameraUnavailable = cameraGrace && !device;
  const permissionDenied = perm === 'denied' && !!device;

  useEffect(() => {
    if (hasPermission) {
      setPerm('granted');
      return;
    }
    if (askedRef.current) return;
    askedRef.current = true;
    void (async () => {
      const granted = await requestPermission();
      setPerm(granted ? 'granted' : 'denied');
    })();
  }, [hasPermission, requestPermission]);

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

  // ── Selfie capture + eager upload state (mirrors Flutter _handleComplete) ───
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const selfieIdRef = useRef<string | null>(null);
  // Holds the finished liveness-video path (from the recorder) so the review-screen
  // "Try Again" can re-upload it. The recorder itself lives in useVideoRecorder.
  const videoPathRef = useRef<string | null>(null);

  const uploadSelfieAndVideo = useCallback(
    async (selfie: string, videoPath: string | null) => {
      setUploading(true);
      setUploadError(null);
      setRetryInfo(null);
      const onRetry = (attempt: number, total: number) => setRetryInfo({ attempt, total });
      try {
        const selfieId = await withRetry(
          () => api.upload({ uri: selfie, type: 'image/jpeg' }, 'selfie'),
          { onRetry },
        );
        selfieIdRef.current = selfieId;
        setMediaId('selfie', selfieId);
        // Liveness video is best-effort — a failure here must not block the user.
        if (videoPath) {
          try {
            // Transcode the raw recording down to a small evidence clip first.
            const small = await compressVideo(videoPath);
            const videoId = await withRetry(
              () => api.upload({ uri: small, type: 'video/mp4' }, 'liveness_video', MAX_VIDEO_BYTES),
              { onRetry },
            );
            setMediaId('livenessVideo', videoId);
          } catch {
            /* keep the selfie, drop the video (incl. if it exceeded the 5MB cap) */
          }
        }
        setRetryInfo(null);
        setUploading(false);
      } catch (err) {
        setRetryInfo(null);
        setUploading(false);
        const kycError = mapToKycError(err, 'upload');
        setUploadError(kycError.message);
        toast.show({ variant: 'error', title: 'Upload failed', message: kycError.message });
        safeReportError(config.onError, kycError);
      }
    },
    [api, setMediaId, config.onError, toast],
  );

  // ── Liveness state machine ─────────────────────────────────────────────────
  // `handleCapture` is created after `liveness` (it calls liveness.markComplete),
  // so the machine gets it via a ref to avoid a definition cycle.
  const captureRef = useRef<() => void>(() => {});
  const liveness = useLiveness({
    voiceGuidance: config.voiceGuidance,
    onReadyToCapture: () => captureRef.current(),
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
      const file = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
      const raw = `file://${file.filePath}`;
      const compressed = await compressSelfieImage(raw).catch(() => raw);
      setSelfieUri(compressed);
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
  }, [device, liveness, uploadSelfieAndVideo, photoOutput, videoRecorder]);

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
  const handleFace = useCallback((data: LivenessFaceData | null) => {
    const l = livenessRef.current;
    if (!data) {
      l.onNoFace();
      return;
    }
    // Low-light gate (thresholds mirror Flutter's _BrightnessSampler: <62 dark,
    // >200 bright). Feeds the lighting warning + speech and blocks challenges so
    // gestures don't misbehave in poor light.
    l.setLighting(data.brightness < 62 ? 'dark' : data.brightness > 200 ? 'bright' : null);
    if (data.faceCount > 0) l.onFace(data);
    else l.onNoFace();
  }, []);

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
  if (permissionDenied) {
    return (
      <CameraPermissionView
        onRetry={() => {
          askedRef.current = false;
          setPerm('checking');
        }}
      />
    );
  }

  // ── Review (selfie captured) ─────────────────────────────────────────────────
  if (liveness.phase === 'complete' && selfieUri) {
    return (
      <View>
        <SelfiePreview uri={selfieUri} uploading={uploading && !uploadError} />
        {retryInfo && uploading ? (
          <MyazaText variant="bodySmall" color={colors.warning} style={{ textAlign: 'center', marginTop: spacing.sm }}>
            {`Upload failed — retrying (${retryInfo.attempt}/${retryInfo.total})…`}
          </MyazaText>
        ) : null}
        <View style={{ height: spacing.md }} />
        {uploadError ? (
          // The error message itself is shown as a top toast; keep a retry action.
          <MyazaButton
            label="Try Again"
            loading={uploading}
            onPress={() => void uploadSelfieAndVideo(selfieUri, videoPathRef.current)}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <MyazaButton
                label="Retake"
                variant="outline"
                leadingIcon="refresh"
                disabled={uploading}
                onPress={() => {
                  setSelfieUri(null);
                  setUploadError(null);
                  selfieIdRef.current = null;
                  videoPathRef.current = null;
                  liveness.reset();
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <MyazaButton
                label="Continue"
                loading={uploading}
                disabled={uploading || !selfieIdRef.current}
                onPress={nextStep}
              />
            </View>
          </View>
        )}
      </View>
    );
  }

  // ── Failed (timeout / face lost) — mirrors the Flutter failed view: a centred
  //    red message and a full-width "Try Again" button (no icon). ───────────────
  if (liveness.phase === 'failed') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.lg }}>
        <MyazaText variant="bodyMedium" color={colors.error} style={{ textAlign: 'center', fontWeight: '500' }}>
          {liveness.failureReason === 'timeout'
            ? "Time's up. Let's try again."
            : 'Face lost. Please try again.'}
        </MyazaText>
        <View style={{ alignSelf: 'stretch' }}>
          <MyazaButton label="Try Again" onPress={liveness.reset} />
        </View>
      </View>
    );
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

  return (
    <View style={{ alignItems: 'center', gap: spacing.md }}>
      {/* Instruction text — above the circle */}
      <MyazaText variant="heading3" style={{ textAlign: 'center', minHeight: 26 }} color={instrColor}>
        {guidance.text}
      </MyazaText>

      {/* Circular camera with a thick colour-state ring */}
      <View
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
      <ProgressDots total={liveness.totalCount} completed={liveness.completedCount} active={phase === 'challenge' || phase === 'positioning'} />

      {/* Gesture demo avatar */}
      {liveness.activeChallenge ? <LivenessAvatar challenge={liveness.activeChallenge} /> : null}
    </View>
  );
}

const StyleAbsFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

// Lighting warning — 1:1 with the Flutter `_LightingWarningBanner`: amber-50 bg,
// amber-200 border, amber-800 lightbulb + text, fading/sliding in (~300ms).
const AMBER_50 = '#FFFBEB';
const AMBER_200 = '#FDE68A';
const AMBER_800 = '#92400E';

function LightingBanner({ text }: { text: string }): React.ReactElement {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      style={{
        alignSelf: 'stretch',
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.sm,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: AMBER_200,
          backgroundColor: AMBER_50,
          paddingHorizontal: spacing.sm + 4,
          paddingVertical: 10,
        }}
      >
        <Icon name="lightbulb" size={16} color={AMBER_800} />
        <MyazaText variant="bodySmall" color={AMBER_800} style={{ flexShrink: 1, lineHeight: 17 }}>
          {text}
        </MyazaText>
      </View>
    </Animated.View>
  );
}

/** The single guidance string + tone to show under the camera. */
function resolveGuidance(l: ReturnType<typeof useLiveness>): { text: string; tone: 'normal' | 'error' } {
  if (l.multipleFaces) return { text: l.instruction, tone: 'error' };
  // Lighting is shown in its own banner (below), not as the main instruction.
  if (l.phase === 'positioning' && !l.faceDetected) {
    return { text: 'Position your face in the circle', tone: 'normal' };
  }
  if (l.positionGuidance) return { text: positionGuidanceText(l.positionGuidance), tone: 'error' };
  if (l.wrongGesture) return { text: 'Wrong gesture — follow the prompt', tone: 'error' };
  return { text: l.instruction, tone: 'normal' };
}

// Numbered progress steps with connectors — mirrors the web/Flutter SDKs:
// passed = solid green + checkmark, active = green-outlined number, pending =
// grey number. `active` marks the current (completed-th) step as in-progress.
function ProgressDots({
  total,
  completed,
  active,
}: {
  total: number;
  completed: number;
  active: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => {
        const state: 'passed' | 'active' | 'pending' =
          i < completed ? 'passed' : i === completed && active ? 'active' : 'pending';
        return (
          <React.Fragment key={i}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: state === 'passed' ? colors.success : state === 'active' ? colors.background : colors.gray300,
                borderWidth: state === 'active' ? 2 : 0,
                borderColor: colors.success,
              }}
            >
              {state === 'passed' ? (
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  <Path d="M5 13l4 4L19 7" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ) : (
                <MyazaText variant="bodySmall" color={state === 'active' ? colors.success : colors.textMuted} style={{ fontWeight: '700' }}>
                  {String(i + 1)}
                </MyazaText>
              )}
            </View>
            {i < total - 1 ? (
              <View style={{ width: 28, height: 2, backgroundColor: i < completed ? colors.success : colors.gray300 }} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function SelfiePreview({ uri, uploading }: { uri: string; uploading?: boolean }): React.ReactElement {
  const { colors } = useTheme();
  const S = 200;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }}>
      <View style={{ width: S, height: S, borderRadius: S / 2, borderWidth: 4, backgroundColor: '#111111', borderColor: `${colors.primary}33`, overflow: 'hidden' }}>
        {/* borderRadius repeated on the Image — iOS doesn't reliably clip an Image
            child to a rounded parent (same fix as the header brand bar). */}
        <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: S / 2 }} resizeMode="cover" />
        {/* Standard upload loader inside the preview circle (mirrors web/Flutter). */}
        {uploading ? (
          <View style={[StyleAbsFill, { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }]}>
            <MyazaPulseLoader size={64} />
          </View>
        ) : null}
      </View>
      <View style={{ height: spacing.md }} />
      <MyazaText variant="heading3" style={{ textAlign: 'center' }}>
        Looking good!
      </MyazaText>
      <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ textAlign: 'center' }}>
        Tap Continue to submit, or Retake to try again.
      </MyazaText>
    </View>
  );
}
