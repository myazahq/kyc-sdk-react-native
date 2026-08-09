import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { radius, spacing } from '../config/theme';
import { ID_TYPES, documentGuideAspect, getScanSides } from '../config/idTypes';
import { withRetry } from '../services/retry';
import { mapToKycError, safeReportError } from '../services/errors';
import { compressDocumentImage, compressVideo, cropCardRegion } from '../services/mediaCompress';
import { MAX_VIDEO_BYTES } from '../config/captureSettings';
import { KYCError } from '../types/verification';
import type { DocumentCapturePhase } from '../store/kycStore';
import { useEffectiveCountry, useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { useToast } from '../components/toast';
import { MyazaPulseLoader } from '../components/MyazaPulseLoader';
import { CameraPhase } from './document/CameraPhase';
import { CameraPermissionView, CameraUnavailableView, CameraPermissionPrimingView } from '../components/CameraPermissionView';
import { ReadyPrimer } from '../components/ReadyPrimer';
import { READY_DOCUMENT } from '../components/readyPrimerContent';
import { DocumentCropper } from '../components/DocumentCropper';
import { DocumentReview } from '../components/DocumentReview';
import { scanMrzFromImage } from '../mrz/textRecognizer';
import { Icon } from '../components/Icon';

// Document capture — the RN mirror of the Flutter/web DocumentCaptureStep.
// Phases: front → front-preview → back → review (two-sided); front → review
// (one-sided). Manual shutter (VisionCamera) or gallery upload; each side is
// compressed (OCR-conservative) then eagerly uploaded on Continue with retry.
//
// The per-phase title/description live in the SHEET HEADER (KycFlow reads the
// synced `documentCapturePhase` from the store and calls `documentCaptureMeta`),
// not in the body — mirroring Flutter's header `docReviewPhase` sync.

/** The header title/description for a document-capture phase. Used by KycFlow. */
export function documentCaptureMeta(
  phase: DocumentCapturePhase,
  documentLabel: string,
): { title: string; description: string } {
  // Copy matches the Flutter SDK's document-capture header meta exactly.
  switch (phase) {
    case 'front':
      return {
        title: `Capture Your ${documentLabel}`,
        description: `Photograph your ${documentLabel} — position it within the frame and hold steady.`,
      };
    case 'front-preview':
      return {
        title: 'Front Side Captured',
        description: 'Looks good? Tap Next to flip the card and scan the back side.',
      };
    case 'back':
      return {
        title: 'Scan Back Side',
        description: `Now place the BACK of your ${documentLabel} within the frame.`,
      };
    case 'review':
    default:
      return {
        title: `Review Your ${documentLabel}`,
        description: 'Tap Continue to upload and submit your document.',
      };
  }
}

/** Bound on how long Continue waits for the supplementary document video. */
const DOC_VIDEO_WAIT_MS = 8000;

/** Home-indicator / nav-bar clearance for the full-screen camera's controls. */
function cameraBottomInset(): number {
  const sa = initialWindowMetrics?.insets;
  if (Platform.OS === 'android') return (sa?.bottom ?? 0) + 12;
  return sa?.bottom || 34;
}

export function DocumentCaptureStep(): React.ReactElement {
  const { colors } = useTheme();
  const toast = useToast();
  const config = useKycConfig();
  const selectedIdType = useKyc((s) => s.selectedIdType);
  const api = useKyc((s) => s.api);
  const setMediaId = useKyc((s) => s.setMediaId);
  const setMrzScan = useKyc((s) => s.setMrzScan);
  const mrzScan = useKyc((s) => s.mrzScan);
  const country = useEffectiveCountry();
  const setDocumentCapturePhase = useKyc((s) => s.setDocumentCapturePhase);
  const setImmersiveCapture = useKyc((s) => s.setImmersiveCapture);
  const store = useKycStore();
  const nextStep = useKyc((s) => s.nextStep);

  const allowUpload = config.allowDocumentUpload !== false;
  const documentLabel =
    (selectedIdType && Object.values(ID_TYPES).flat().find((t) => t.key === selectedIdType)?.label) || 'Document';
  const scanSides = selectedIdType ? getScanSides(selectedIdType) : 'front_only';
  const isTwoSided = scanSides === 'front_and_back';
  const guideAspect = documentGuideAspect(selectedIdType);

  const [phase, setPhase] = useState<DocumentCapturePhase>('front');
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // compressing a fresh capture
  const [uploading, setUploading] = useState(false);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null); // gallery photo awaiting crop
  // Best-effort document videos recorded alongside each side's still (uploaded as
  // document_front_video / document_back_video). Refs — they don't drive the UI.
  const frontVideoRef = useRef<string | null>(null);
  const backVideoRef = useRef<string | null>(null);

  // Publish the sub-phase so the sheet header (KycFlow) shows the right title.
  useEffect(() => {
    setDocumentCapturePhase(phase);
  }, [phase, setDocumentCapturePhase]);


  // ── Camera permission ──────────────────────────────────────────────────────
  // `perm` is derived from the ASYNC requestPermission result, not synchronously
  // from `hasPermission` — otherwise the brief window while the OS prompt is open
  // (hasPermission still false) would read as "denied" and fire onError early.
  // 'priming' shows the "Allow camera access" screen BEFORE the OS prompt
  // (Stripe-style); the prompt only fires (→ 'requesting') once the user taps
  // "Grant access".
  const { hasPermission, requestPermission } = useCameraPermission();
  const [perm, setPerm] = useState<'priming' | 'requesting' | 'granted' | 'denied'>(
    hasPermission ? 'granted' : 'priming',
  );
  const permReportedRef = useRef(false);

  // ── Camera availability ─────────────────────────────────────────────────────
  // Even with permission granted, there may be no usable back camera (the iOS/
  // Android simulator has none; a real device may fail to init). Give the device
  // list a moment to resolve, then surface a proper "Camera not available" error
  // with an upload fallback — on every iOS version (glass or not) and Android.
  // Device enumeration does NOT need camera permission (iOS AVCaptureDevice /
  // Android CameraManager list hardware regardless), so `!device` reliably means
  // "no back-camera hardware" — true on every simulator. That's a different state
  // from "permission denied": no hardware → nothing to grant.
  const device = useCameraDevice('back');
  const [cameraGrace, setCameraGrace] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCameraGrace(true), 1500);
    return () => clearTimeout(t);
  }, []);
  // No camera hardware at all → "Camera not available" (regardless of what the
  // permission API says — on a camera-less sim it may even report denied).
  const cameraUnavailable = cameraGrace && !device;
  // Gate the camera path on the user acknowledging the primer. Shown once for
  // the step, not per side — repeating it before the back of a card would be
  // noise, not a warning.
  const [ready, setReady] = useState(false);
  const showPrimer = perm === 'priming' && !!device;
  // Tell the shell when the full-bleed camera is on screen. Scoped tightly:
  // only the live preview earns the whole display — the ready primer, the
  // permission screens, the previews and the review all keep their chrome.
  //
  // No unmount cleanup: KycFlow already scopes the flag to this step, and a
  // cleanup here would fire during any remount and fight the effect that had
  // just raised it.
  const cameraLive =
    (phase === 'front' || phase === 'back') && ready && perm === 'granted' && !!device;
  useEffect(() => {
    setImmersiveCapture(cameraLive);
  }, [cameraLive, setImmersiveCapture]);

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

  // A *genuine* permission denial requires a camera to exist but be blocked. On a
  // camera-less sim the OS may report denied — that's "not available", not a
  // permission problem, so don't treat it as denied or report onError there.
  const permissionDenied = perm === 'denied' && !!device;
  useEffect(() => {
    if (permissionDenied && !permReportedRef.current) {
      permReportedRef.current = true;
      safeReportError(
        config.onError,
        new KYCError(
          'camera_permission_denied',
          'Camera access is required to photograph your document. Allow camera access or upload a photo instead.',
        ),
      );
    }
    if (!permissionDenied) permReportedRef.current = false;
  }, [permissionDenied, config.onError]);

  const retryPermission = useCallback(() => {
    setPerm('requesting');
  }, []);

  // ── Capture → compress → store for the current side ────────────────────────
  const storeCapture = useCallback(
    async (rawUri: string) => {
      setBusy(true);
      setUploadError(null);
      try {
        const compressed = await compressDocumentImage(rawUri);
        // Read the MRZ off the FRONT while we have it. It is the key that
        // unlocks the chip, and taking it from the photo the user just captured
        // is what spares them scanning the same passport a second time.
        // Best-effort in every sense: most documents have no MRZ, and one that
        // does not read simply leaves the chip step to ask.
        if (phase !== 'back') {
          void scanMrzFromImage(compressed)
            .then((scan) => {
              if (scan) setMrzScan(scan);
            })
            // Explicit, even though the scanner already swallows its own
            // errors: this sits inside the capture path, and the claim above
            // that it is best-effort has to hold for anything that can reject
            // — including a future change to the store setter.
            .catch(() => undefined);
        }
        if (phase === 'back') {
          setBackUri(compressed);
          setPhase('review');
        } else {
          setFrontUri(compressed);
          setPhase(isTwoSided ? 'front-preview' : 'review');
        }
      } finally {
        setBusy(false);
      }
    },
    [phase, isTwoSided, setMrzScan],
  );

  // Gallery upload: pick the raw photo (no native editor), then open the SDK's
  // interactive ID-card cropper — mirrors the Flutter SDK's _DocumentCropperScreen.
  // Live-camera capture: crop the full frame to the card-guide rectangle first
  // (mirrors Flutter's cropCardRegion), then store. Gallery photos skip this —
  // they're already cropped by the interactive cropper.
  const captureFromCamera = useCallback(
    async (rawUri: string, videoPath: string | null, viewAr: number) => {
      setBusy(true);
      try {
        // Stash the side's video (best-effort) before cropping/storing the still.
        if (phase === 'back') backVideoRef.current = videoPath;
        else frontVideoRef.current = videoPath;
        // viewAr is the MEASURED preview box — full-screen capture shows a far
        // taller slice than the framed 3:4 box the old constant assumed, which
        // is why reviews came back wider than what the user framed.
        const carded = await cropCardRegion(rawUri, guideAspect, viewAr).catch(() => rawUri);
        await storeCapture(carded);
      } finally {
        setBusy(false);
      }
    },
    [guideAspect, storeCapture, phase],
  );

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setCropUri(result.assets[0].uri);
    }
  }, []);

  // Best-effort document video upload — never blocks or fails the flow.
  /**
   * How long the flow will WAIT for a document video before moving on.
   *
   * The clip is supplementary evidence, but transcoding a 4K recording and
   * pushing it over a phone hotspot is slow — and it used to be awaited with no
   * bound, so the step sat on a spinner indefinitely after the photo had
   * already uploaded fine. The user could not reach the chip step at all.
   *
   * The upload is NOT cancelled at the deadline: it keeps running in the
   * background and still records its media id if it lands, usually well before
   * submission. Only the WAIT is bounded.
   */
  const uploadDocVideo = useCallback(
    async (
      videoPath: string | null,
      type: 'document_front_video' | 'document_back_video',
      mediaKey: 'documentFrontVideo' | 'documentBackVideo',
    ) => {
      if (!videoPath) return;
      const work = (async () => {
        try {
          // Transcode the raw 4K recording down to a small evidence clip first.
          const small = await compressVideo(videoPath);
          const id = await withRetry(() => api.upload({ uri: small, type: 'video/mp4' }, type, MAX_VIDEO_BYTES));
          setMediaId(mediaKey, id);
        } catch {
          /* supplementary — verification proceeds without the document video
             (dropped if it failed to upload or exceeded the 5MB ceiling) */
        }
      })();
      await Promise.race([
        work,
        new Promise<void>((resolve) => setTimeout(resolve, DOC_VIDEO_WAIT_MS)),
      ]);
    },
    [api, setMediaId],
  );

  // ── Upload both sides, then advance (KycFlow routes to liveness/submitted) ──
  const handleContinue = useCallback(async () => {
    if (!frontUri) return;
    setUploading(true);
    setUploadError(null);
    setRetryInfo(null);
    const onRetry = (attempt: number, total: number) => setRetryInfo({ attempt, total });
    try {
      const frontId = await withRetry(() => api.upload({ uri: frontUri, type: 'image/jpeg' }, 'document_front'), { onRetry });
      setMediaId('documentFront', frontId);
      await uploadDocVideo(frontVideoRef.current, 'document_front_video', 'documentFrontVideo');
      if (isTwoSided && backUri) {
        const backId = await withRetry(() => api.upload({ uri: backUri, type: 'image/jpeg' }, 'document_back'), { onRetry });
        setMediaId('documentBack', backId);
        await uploadDocVideo(backVideoRef.current, 'document_back_video', 'documentBackVideo');
      }
      setRetryInfo(null);
      setUploading(false);
      nextStep();
    } catch (err) {
      setRetryInfo(null);
      setUploading(false);
      const kycError = mapToKycError(err, 'upload');
      setUploadError(kycError.message);
      toast.show({ variant: 'error', title: 'Upload failed', message: kycError.message });
      safeReportError(config.onError, kycError);
    }
  }, [frontUri, backUri, isTwoSided, api, setMediaId, nextStep, config.onError, toast, uploadDocVideo]);

  const retake = (side: 'front' | 'back') => {
    setUploadError(null);
    if (side === 'back') {
      setBackUri(null);
      backVideoRef.current = null;
      setPhase('back');
    } else {
      setFrontUri(null);
      frontVideoRef.current = null;
      setPhase('front');
    }
  };

  // Interactive ID-card cropper for a gallery photo (Modal — overlays whatever
  // capture sub-screen triggered the upload, including the sim's "camera unavailable").
  const cropper = cropUri ? (
    <DocumentCropper
      uri={cropUri}
      onCancel={() => setCropUri(null)}
      onConfirm={(out) => {
        setCropUri(null);
        void storeCapture(out);
      }}
    />
  ) : null;

  // ── Capture (front/back) ───────────────────────────────────────────────────
  // Two distinct error states, distinguished by hardware vs permission (both
  // states keep the title/description in the header, and always offer the gallery
  // escape hatch). These never overlap: one needs a device, the other needs none.
  if (phase === 'front' || phase === 'back') {
    if (cameraUnavailable) {
      // No back-camera hardware (e.g. a simulator) — permission is moot here.
      return (
        <>
          {cropper}
          <CameraUnavailableView onUpload={pickFromGallery} />
        </>
      );
    }
    if (!ready) {
      // "Here's what happens next", BEFORE the OS prompt — and shown even when
      // permission is already granted, since it is about what the step asks of
      // the user rather than about access.
      return (
        <>
          {cropper}
          <ReadyPrimer content={READY_DOCUMENT} onReady={() => setReady(true)} />
        </>
      );
    }
    if (showPrimer) {
      // Primer before the OS prompt — camera not started yet.
      return (
        <>
          {cropper}
          <CameraPermissionPrimingView
            message="When prompted, allow camera access to photograph your document."
            onGrant={() => setPerm('requesting')}
          />
        </>
      );
    }
    if (permissionDenied) {
      // A real camera exists but the OS blocked access.
      return (
        <>
          {cropper}
          <CameraPermissionView onRetry={retryPermission} onUpload={pickFromGallery} />
        </>
      );
    }
    const isBack = phase === 'back';

    return (
      <>
        {cropper}
        <CameraPhase
          isBack={isBack}
          cameraLive={cameraLive}
          active={perm === 'granted'}
          documentLabel={documentLabel}
          guideAspect={guideAspect}
          isTwoSided={isTwoSided}
          busy={busy}
          allowUpload={allowUpload}
          country={country}
          idType={selectedIdType ?? undefined}
          mrzAlreadyCaptured={!!mrzScan}
          onMrz={setMrzScan}
          onCapture={(uri, videoPath, viewAr) => void captureFromCamera(uri, videoPath, viewAr)}
          onUpload={pickFromGallery}
          onBack={() => store.getState().previousStep()}
          // The camera is a TRUE full-screen modal now, so it runs under the
          // home indicator and has to clear the real inset — the smaller value
          // that suited the inset sheet leaves the shutter under the gesture bar.
          bottomInset={cameraBottomInset()}
        />
      </>
    );
  }


  // ── Front preview (two-sided) ──────────────────────────────────────────────
  if (phase === 'front-preview') {
    return (
      <View>
        <DocImage uri={frontUri!} />
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <MyazaButton label="Retake" variant="outline" leadingIcon="refresh" onPress={() => retake('front')} />
          </View>
          <View style={{ flex: 1 }}>
            <MyazaButton label="Next — Scan Back" onPress={() => setPhase('back')} />
          </View>
        </View>
      </View>
    );
  }

  // ── Review ─────────────────────────────────────────────────────────────────
  return (
    <DocumentReview
      frontUri={frontUri!}
      backUri={isTwoSided ? backUri : null}
      aspect={guideAspect}
      isBusy={uploading}
      busyOverlay={
        // Standard upload loader — a dark scrim + the pulse-ring loader, drawn
        // INSIDE the preview frame, mirroring the web/Flutter SDKs (and the
        // liveness selfie review).
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        >
          <MyazaPulseLoader size={48} />
        </View>
      }
      onRetakeFront={() => retake('front')}
      onRetakeBack={() => retake('back')}
      footer={
        <>
          {retryInfo && uploading ? (
            <MyazaText variant="bodySmall" color={colors.warning} style={{ textAlign: 'center', marginBottom: spacing.sm }}>
              {`Upload failed — retrying (${retryInfo.attempt}/${retryInfo.total})…`}
            </MyazaText>
          ) : null}
          {uploadError ? (
            // The error message is shown as a top toast; keep a retry action here.
            <MyazaButton label="Try Again" onPress={handleContinue} loading={uploading} />
          ) : (
            <MyazaButton label="Continue" onPress={handleContinue} loading={uploading} />
          )}
        </>
      }
    />
  );
}

function DocImage({ uri, label, uploading }: { uri: string; label?: string; uploading?: boolean }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View>
      {label ? (
        <MyazaText variant="bodySmall" color={colors.textMuted} style={{ textAlign: 'center', marginBottom: spacing.xs }}>
          {label}
        </MyazaText>
      ) : null}
      <View style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <Image source={{ uri }} style={{ width: '100%', aspectRatio: 1.586 }} resizeMode="cover" />
        {/* Standard upload loader — a dark scrim + the pulse-ring/spinner loader
            rendered INSIDE the preview frame, mirroring the web/Flutter SDKs (and
            the liveness selfie review). */}
        {uploading ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}
          >
            <MyazaPulseLoader size={64} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
