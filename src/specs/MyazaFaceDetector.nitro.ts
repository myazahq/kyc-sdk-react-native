import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

// ---------------------------------------------------------------------------
// Nitro spec for the on-device face detector (VisionCamera v5).
//
// v5 replaced the old `FrameProcessorPlugin` + `VISION_EXPORT_SWIFT_FRAME_PROCESSOR`
// macro / `FrameProcessorPluginRegistry` model with **Nitro HybridObjects**. This
// `.nitro.ts` spec is the single source of truth: nitrogen generates the Swift
// (`HybridMyazaFaceDetectorSpec`) and Kotlin (`HybridMyazaFaceDetectorSpec`) base
// classes from it, and `nitro.json` autolinks the concrete impls
// (`HybridMyazaFaceDetector`) — iOS = Apple Vision, Android = Google ML Kit.
//
// The detector runs inside the camera-thread worklet (`useFrameOutput`): the
// boxed HybridObject is unboxed in the worklet and `detectFace(frame)` is called
// synchronously per frame (the frame never crosses the JS bridge).
// ---------------------------------------------------------------------------

/**
 * Per-frame face signals, identical in shape to {@link LivenessFaceData} in
 * `../liveness/types`. `faceCount === 0` means "no face" (the worklet maps that
 * to `onNoFace()` — Nitro return types are non-nullable, so we use the count as
 * the presence signal rather than returning `null`).
 */
export interface FaceResult {
  headEulerAngleX: number; // pitch (nod), degrees; negative = down
  headEulerAngleY: number; // yaw (turn), degrees; positive = left
  headEulerAngleZ: number; // roll, degrees
  smilingProbability: number; // 0–1
  leftEyeOpenProbability: number; // 0–1
  rightEyeOpenProbability: number; // 0–1
  faceSizeRatio: number; // face width / frame width (0–1)
  faceCount: number; // # faces in frame; 0 = no face
  brightness: number; // mean luma of the frame (0–255), for the low-light gate
  faceCenterX: number; // face centre X, normalised 0–1 (−1 when unavailable)
  faceCenterY: number; // face centre Y, normalised 0–1 (−1 when unavailable)
  trackingId: number; // ML Kit per-face id; −1 on iOS / when untracked
  // Mean RGB of the FACE REGION (0–255 each), for flash (screen-reflection)
  // liveness. Sampled in this same pass because the pixel buffer is already
  // mapped here — a second native module would mean a second frame walk for
  // numbers we can take for free. −1 when no face was found.
  faceR: number;
  faceG: number;
  faceB: number;
}

export interface MyazaFaceDetector extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Detect the dominant face in a camera {@link Frame} and return its gesture
   * signals. Called per-frame from the VisionCamera worklet. Returns
   * `faceCount: 0` when no face is present.
   */
  detectFace(frame: Frame): FaceResult;
}
