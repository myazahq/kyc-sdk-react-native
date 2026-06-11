// ---------------------------------------------------------------------------
// FaceDetectorService — the clean native boundary for liveness.
//
// This is the ONLY thing the liveness screen/store sees. It mirrors the Flutter
// SDK's `FaceDetectorService`: the core SDK depends on this interface, never on
// a concrete ML library, so liveness math, anti-spoofing thresholds, and camera
// assumptions never leak into screens — and a shared native core can be
// extracted later without touching the flow.
//
// Implementations:
//   • VisionCameraFaceDetector (default, wired in Step 4) — a
//     react-native-vision-camera frame-processor plugin: Apple Vision on iOS,
//     Google ML Kit on Android. No cross-platform ML Kit iOS pod, so it builds
//     on Apple-Silicon iOS simulators.
//   • StubFaceDetectorService — no-op fallback (always "no face"). The Step-1/2
//     default and the test override.
// ---------------------------------------------------------------------------

import type { LivenessFaceData } from './types';

/**
 * An opaque camera frame. Typed as `unknown` here so the core stays free of the
 * react-native-vision-camera dependency; the native detector narrows it to a
 * VisionCamera `Frame` inside its worklet.
 */
export type FaceDetectorFrame = unknown;

export interface FaceDetectorService {
  /** Prepares the detector for use. Called once before {@link detect}. */
  initialize(): void;

  /**
   * Processes a single camera frame and returns the dominant face's gesture
   * data, or `null` when no usable face is present (or this is the stub).
   * Runs in a frame-processor worklet, so it is synchronous.
   */
  detect(frame: FaceDetectorFrame): LivenessFaceData | null;

  /** Releases any native resources. Safe to call multiple times. */
  dispose(): void;
}

/** No-op detector — always reports "no face", so liveness never self-advances. */
export class StubFaceDetectorService implements FaceDetectorService {
  initialize(): void {}
  detect(): LivenessFaceData | null {
    return null;
  }
  dispose(): void {}
}

// ---------------------------------------------------------------------------
// Detector registry — a process-wide factory hook.
// ---------------------------------------------------------------------------

let faceDetectorFactory: (() => FaceDetectorService) | null = null;

/**
 * Overrides the factory used to create the SDK's {@link FaceDetectorService}.
 * Optional — call once at startup, before launching the KYC flow. Used by the
 * native detector to install itself, and by tests to install the stub.
 */
export function registerFaceDetectorFactory(factory: () => FaceDetectorService): void {
  faceDetectorFactory = factory;
}

/** Whether a host/native module has overridden the detector factory. */
export function hasFaceDetectorFactory(): boolean {
  return faceDetectorFactory !== null;
}

/**
 * Creates a {@link FaceDetectorService} — the registered factory if one is set,
 * otherwise the {@link StubFaceDetectorService}. (Step 4 registers the
 * VisionCamera detector as the default at module load.)
 */
export function createFaceDetectorService(): FaceDetectorService {
  return (faceDetectorFactory ?? (() => new StubFaceDetectorService()))();
}
