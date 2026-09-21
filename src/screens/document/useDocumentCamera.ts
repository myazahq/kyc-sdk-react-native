import { useCallback, useEffect, useRef, useState } from 'react';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import { safeReportError } from '../../services/errors';
import { KYCError } from '../../types/verification';

// The document camera's permission and hardware state, lifted out of
// DocumentCaptureStep so that only a workflow which SCANS ever calls
// VisionCamera's hooks. An upload-only workflow (`allowDocumentScan: false`)
// never mounts the component that uses this, so it never reads the camera
// permission, never enumerates devices and never prompts. The logic is the
// step's own, moved rather than changed.

export type DocumentCameraPermission = 'priming' | 'requesting' | 'granted' | 'denied';

export interface DocumentCamera {
  perm: DocumentCameraPermission;
  /** A back camera exists (false on a simulator, which has none). */
  hasDevice: boolean;
  /** No camera hardware at all, once the device list has had a moment. */
  cameraUnavailable: boolean;
  /** The "Allow camera access" primer, shown before the OS prompt. */
  showPrimer: boolean;
  /** A real camera exists but the OS blocked access. */
  permissionDenied: boolean;
  /** Fire the real OS prompt: the primer's "Grant access", or a retry. */
  requestAccess: () => void;
}

export function useDocumentCamera(onError: ((error: KYCError) => void) | undefined): DocumentCamera {
  // ── Camera permission ──────────────────────────────────────────────────────
  // `perm` is derived from the ASYNC requestPermission result, not synchronously
  // from `hasPermission` — otherwise the brief window while the OS prompt is open
  // (hasPermission still false) would read as "denied" and fire onError early.
  // 'priming' shows the "Allow camera access" screen BEFORE the OS prompt
  // (Stripe-style); the prompt only fires (→ 'requesting') once the user taps
  // "Grant access".
  const { hasPermission, requestPermission } = useCameraPermission();
  const [perm, setPerm] = useState<DocumentCameraPermission>(hasPermission ? 'granted' : 'priming');
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
        onError,
        new KYCError(
          'camera_permission_denied',
          'Camera access is required to photograph your document. Allow camera access or upload a photo instead.',
        ),
      );
    }
    if (!permissionDenied) permReportedRef.current = false;
  }, [permissionDenied, onError]);

  const requestAccess = useCallback(() => {
    setPerm('requesting');
  }, []);

  return {
    perm,
    hasDevice: !!device,
    cameraUnavailable,
    showPrimer: perm === 'priming' && !!device,
    permissionDenied,
    requestAccess,
  };
}
