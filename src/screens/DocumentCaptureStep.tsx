import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import { radius, spacing } from '../config/theme';
import { ID_TYPES, documentGuideAspect, getScanSides } from '../config/idTypes';
import { withRetry } from '../services/retry';
import { mapToKycError, safeReportError } from '../services/errors';
import { compressDocumentImage, compressVideo, cropCardRegion } from '../services/mediaCompress';
import { MAX_VIDEO_BYTES } from '../config/captureSettings';
import { KYCError } from '../types/verification';
import type { DocumentCapturePhase } from '../store/kycStore';
import { useKyc, useKycConfig, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { useToast } from '../components/toast';
import { MyazaPulseLoader } from '../components/MyazaPulseLoader';
import { CameraViewfinder } from '../components/CameraViewfinder';
import { CameraPermissionView, CameraUnavailableView } from '../components/CameraPermissionView';
import { DocumentCropper } from '../components/DocumentCropper';
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

export function DocumentCaptureStep(): React.ReactElement {
  const { colors } = useTheme();
  const toast = useToast();
  const config = useKycConfig();
  const selectedIdType = useKyc((s) => s.selectedIdType);
  const api = useKyc((s) => s.api);
  const setMediaId = useKyc((s) => s.setMediaId);
  const setDocumentCapturePhase = useKyc((s) => s.setDocumentCapturePhase);
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
  const { hasPermission, requestPermission } = useCameraPermission();
  const [perm, setPerm] = useState<'checking' | 'granted' | 'denied'>(hasPermission ? 'granted' : 'checking');
  const askedRef = useRef(false);
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
    askedRef.current = false;
    setPerm('checking');
  }, []);

  // ── Capture → compress → store for the current side ────────────────────────
  const storeCapture = useCallback(
    async (rawUri: string) => {
      setBusy(true);
      setUploadError(null);
      try {
        const compressed = await compressDocumentImage(rawUri);
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
    [phase, isTwoSided],
  );

  // Gallery upload: pick the raw photo (no native editor), then open the SDK's
  // interactive ID-card cropper — mirrors the Flutter SDK's _DocumentCropperScreen.
  // Live-camera capture: crop the full frame to the card-guide rectangle first
  // (mirrors Flutter's cropCardRegion), then store. Gallery photos skip this —
  // they're already cropped by the interactive cropper.
  const captureFromCamera = useCallback(
    async (rawUri: string, videoPath: string | null) => {
      setBusy(true);
      try {
        // Stash the side's video (best-effort) before cropping/storing the still.
        if (phase === 'back') backVideoRef.current = videoPath;
        else frontVideoRef.current = videoPath;
        const carded = await cropCardRegion(rawUri, guideAspect).catch(() => rawUri);
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
  const uploadDocVideo = useCallback(
    async (
      videoPath: string | null,
      type: 'document_front_video' | 'document_back_video',
      mediaKey: 'documentFrontVideo' | 'documentBackVideo',
    ) => {
      if (!videoPath) return;
      try {
        // Transcode the raw 4K recording down to a small evidence clip first.
        const small = await compressVideo(videoPath);
        const id = await withRetry(() => api.upload({ uri: small, type: 'video/mp4' }, type, MAX_VIDEO_BYTES));
        setMediaId(mediaKey, id);
      } catch {
        /* supplementary — verification proceeds without the document video
           (dropped if it failed to upload or exceeded the 5MB ceiling) */
      }
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
      <View>
        {cropper}
        {/* Required pill: ID label + side badge + step label (two-sided) */}
        <RequiredPill
          documentLabel={documentLabel}
          sideBadge={isTwoSided ? (isBack ? 'Back Side' : 'Front Side') : undefined}
          stepLabel={isTwoSided ? (isBack ? 'Step 2 of 2' : 'Step 1 of 2') : undefined}
        />
        {isBack ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xs }}>
            <Icon name="credit-card" size={14} color={colors.primary} />
            <View style={{ width: 4 }} />
            <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '500' }}>
              Flip the card over and scan the other side
            </MyazaText>
          </View>
        ) : null}
        <View style={{ height: spacing.md }} />
        <CameraViewfinder
          active={perm === 'granted'}
          side={isBack ? 'back' : 'front'}
          documentLabel={documentLabel}
          guideAspect={guideAspect}
          onCapture={(uri, videoPath) => void captureFromCamera(uri, videoPath)}
          busy={busy}
        />
        {!busy ? (
          <>
            <View style={{ height: spacing.md }} />
            <MyazaText variant="bodySmall" style={{ textAlign: 'center' }}>
              Tap the button to capture manually
            </MyazaText>
            {allowUpload ? (
              <Pressable onPress={pickFromGallery} style={{ marginTop: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <MyazaText variant="bodySmall">Having trouble? </MyazaText>
                  <Icon name="upload" size={14} color={colors.primary} />
                  <View style={{ width: 4 }} />
                  <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '700' }}>
                    Upload a photo instead
                  </MyazaText>
                </View>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
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
    <View>
      <DocImage uri={frontUri!} label={isTwoSided ? 'Front' : undefined} uploading={uploading} />
      <MyazaButton label="Retake" variant="ghost" leadingIcon="refresh" onPress={() => retake('front')} disabled={uploading} />
      {isTwoSided && backUri ? (
        <>
          <View style={{ height: spacing.md }} />
          <DocImage uri={backUri} label="Back" uploading={uploading} />
          <MyazaButton label="Retake Back" variant="ghost" leadingIcon="refresh" onPress={() => retake('back')} disabled={uploading} />
        </>
      ) : null}

      {retryInfo && uploading ? (
        <MyazaText variant="bodySmall" color={colors.warning} style={{ textAlign: 'center', marginTop: spacing.sm }}>
          {`Upload failed — retrying (${retryInfo.attempt}/${retryInfo.total})…`}
        </MyazaText>
      ) : null}

      <View style={{ height: spacing.md }} />
      {uploadError ? (
        // The error message is shown as a top toast; keep a retry action here.
        <MyazaButton label="Try Again" onPress={handleContinue} loading={uploading} />
      ) : (
        <MyazaButton label="Continue" onPress={handleContinue} loading={uploading} />
      )}
    </View>
  );
}

// "Required: {label}" pill with optional side badge + step label — mirrors the
// Flutter SDK's _RequiredPill on the capture screen.
function RequiredPill({
  documentLabel,
  sideBadge,
  stepLabel,
}: {
  documentLabel: string;
  sideBadge?: string;
  stepLabel?: string;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          borderWidth: 1,
          borderColor: `${colors.primary}33`,
          backgroundColor: `${colors.primary}0D`,
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm + 4,
          paddingVertical: spacing.sm,
        }}
      >
        <Icon name="credit-card" size={16} color={colors.primary} />
        <View style={{ width: 8 }} />
        <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '600' }}>
          Required:{' '}
        </MyazaText>
        <MyazaText variant="bodySmall" color={colors.primary} style={{ flexShrink: 1 }}>
          {documentLabel}
        </MyazaText>
        {sideBadge ? (
          <View style={{ backgroundColor: `${colors.primary}26`, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 }}>
            <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '600', fontSize: 11 }}>
              {sideBadge}
            </MyazaText>
          </View>
        ) : null}
      </View>
      {stepLabel ? (
        <MyazaText variant="bodySmall" color={colors.textMuted} style={{ marginLeft: spacing.sm }}>
          {stepLabel}
        </MyazaText>
      ) : null}
    </View>
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
