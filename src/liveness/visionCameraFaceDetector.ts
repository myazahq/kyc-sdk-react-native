// ---------------------------------------------------------------------------
// VisionCameraFaceDetector — the default FaceDetectorService, backed by the
// native VisionCamera v5 **Nitro** face detector (Apple Vision on iOS, Google
// ML Kit on Android; see ios/ + android/, generated from
// `../specs/MyazaFaceDetector.nitro.ts`).
//
// v5 frame processors run in a WORKLET on the camera thread. To call a Nitro
// HybridObject from that worklet, the object is **boxed** on the JS thread and
// **unboxed** inside the worklet (Nitro's worklet-sharing mechanism). The camera
// frame never crosses the JS bridge — only the small `FaceResult` comes back.
//
// This module exposes:
//   1. `detectFaceOnFrame(frame)` — a WORKLET that unboxes the detector, runs it
//      on the frame, and returns `LivenessFaceData | null`. LivenessStep calls
//      this inside its `useFrameOutput({ onFrame })`.
//   2. A `FaceDetectorService` registration (at module load) so the rest of the
//      SDK — and `createFaceDetectorService()` — resolves to this detector by
//      default, mirroring the Flutter SDK's `NativeFaceDetectorService`.
//
// If the native Nitro detector isn't registered (e.g. Expo Go, or a build
// without the SDK's native code), `hasHybridObject` is false and the worklet
// falls back to "no face" — the JS flow degrades gracefully instead of crashing.
// ---------------------------------------------------------------------------

import { NitroModules } from 'react-native-nitro-modules';
import type { BoxedHybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

import type { FaceResult, MyazaFaceDetector } from '../specs/MyazaFaceDetector.nitro';
import {
  registerFaceDetectorFactory,
  type FaceDetectorService,
  type FaceDetectorFrame,
} from './faceDetector';
import type { LivenessFaceData } from './types';

// Create the native Nitro detector once. Guarded by `hasHybridObject` so a build
// without the native code (Expo Go) degrades to "no face" rather than throwing.
const detector: MyazaFaceDetector | null = NitroModules.hasHybridObject('MyazaFaceDetector')
  ? NitroModules.createHybridObject<MyazaFaceDetector>('MyazaFaceDetector')
  : null;

// Box the detector so it can be unboxed inside the camera-thread worklet.
const boxedDetector: BoxedHybridObject<MyazaFaceDetector> | null = detector
  ? NitroModules.box(detector)
  : null;

/**
 * Start fetching the face model, so it is warm by the time liveness runs.
 *
 * Android fetches ML Kit's models through Play Services rather than bundling
 * them, which keeps ~18.5 MB per device out of the APK but leaves a window on
 * first launch where detection cannot work. Priming at flow start puts that
 * download behind the consent and ID-type screens instead of in front of the
 * camera.
 *
 * Best-effort and non-blocking, exactly like the web SDK's `primeFaceMesh()`:
 * a failure here is not fatal, because {@link isFaceModelReady} is what the
 * liveness step actually gates on. iOS resolves immediately (Apple Vision is a
 * system framework).
 */
export function primeFaceModel(): void {
  detector?.prepareModel().catch(() => {
    /* best-effort: isFaceModelReady() is the real gate */
  });
}

/**
 * Whether face detection can run right now.
 *
 * Checked BEFORE the camera opens. `detectFace` cannot answer this — a missing
 * model and an empty frame are both `faceCount: 0`, so gating on the per-frame
 * result would strand the user on "position your face" with no explanation.
 *
 * `true` when the native module is absent entirely (Expo Go), because that path
 * already degrades to the existing camera-unavailable screen and should not be
 * reported as a model problem.
 */
export function isFaceModelReady(): boolean {
  return detector?.isModelReady() ?? true;
}

/**
 * Maps the native {@link FaceResult} to a {@link LivenessFaceData}, or `null`
 * when no face is present (`faceCount === 0`). A worklet — runs on the camera
 * thread.
 */
function toFaceData(raw: FaceResult | null): LivenessFaceData | null {
  'worklet';
  // Always forward the result (even with faceCount 0) so the caller can read
  // `brightness` for the low-light gate before a face is in frame. `faceCount`
  // distinguishes face / no-face downstream.
  if (raw == null) return null;
  return {
    headEulerAngleX: raw.headEulerAngleX,
    headEulerAngleY: raw.headEulerAngleY,
    headEulerAngleZ: raw.headEulerAngleZ,
    smilingProbability: raw.smilingProbability,
    leftEyeOpenProbability: raw.leftEyeOpenProbability,
    rightEyeOpenProbability: raw.rightEyeOpenProbability,
    faceSizeRatio: raw.faceSizeRatio,
    faceCount: raw.faceCount,
    brightness: raw.brightness,
    // −1 is the natives' "not available" sentinel (iOS Vision has no tracking
    // id; neither reports a centre for the no-face frame). Map it to undefined
    // so the continuity guard sees an absent signal rather than a real value of
    // −1 sitting outside the 0–1 range.
    faceCenterX: raw.faceCenterX >= 0 ? raw.faceCenterX : undefined,
    faceCenterY: raw.faceCenterY >= 0 ? raw.faceCenterY : undefined,
    trackingId: raw.trackingId >= 0 ? raw.trackingId : undefined,
    // −1 is the native "could not sample" sentinel; mapping it to undefined
    // keeps "unknown" out of the arithmetic, where it would read as pure black
    // and manufacture a colour shift.
    faceRgb:
      raw.faceR >= 0 && raw.faceG >= 0 && raw.faceB >= 0
        ? ([raw.faceR, raw.faceG, raw.faceB] as const)
        : undefined,
  };
}

/**
 * WORKLET: runs native face detection on a VisionCamera v5 frame and returns the
 * dominant face's gesture signals, or `null` when no face is present / the native
 * detector is unavailable. Call this from inside `useFrameOutput({ onFrame })`.
 */
export function detectFaceOnFrame(frame: Frame): LivenessFaceData | null {
  'worklet';
  if (boxedDetector == null) return null;
  const d = boxedDetector.unbox();
  return toFaceData(d.detectFace(frame));
}

/** Whether the native Nitro face detector is installed in this build. */
export function isNativeFaceDetectorAvailable(): boolean {
  return detector != null;
}

// ---------------------------------------------------------------------------
// FaceDetectorService registration
// ---------------------------------------------------------------------------

/**
 * The default detector service. Its `detect(frame)` delegates to the worklet
 * helper — `frame` here is the opaque VisionCamera `Frame`. In practice the
 * LivenessStep calls `detectFaceOnFrame` directly inside its frame output
 * worklet; this service exists so the registry / `hasFaceDetectorFactory()`
 * contract mirrors Flutter's native default.
 */
class VisionCameraFaceDetector implements FaceDetectorService {
  initialize(): void {
    /* detector is created at module load; nothing per-instance to do */
  }

  detect(frame: FaceDetectorFrame): LivenessFaceData | null {
    return detectFaceOnFrame(frame as Frame);
  }

  dispose(): void {
    /* the native Nitro detector is process-wide; nothing to release per instance */
  }
}

// Install as the default factory unless a host already overrode it (tests call
// `registerFaceDetectorFactory(StubFaceDetectorService.new)` before importing).
registerFaceDetectorFactory(() => new VisionCameraFaceDetector());

export { VisionCameraFaceDetector };
