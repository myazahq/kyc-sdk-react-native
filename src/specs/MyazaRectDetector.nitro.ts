import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

// ---------------------------------------------------------------------------
// Nitro spec for document EDGE detection (VisionCamera v5).
//
// iOS only, on purpose. Apple Vision ships a rectangle detector
// (`VNDetectRectanglesRequest`); ML Kit has no frame-by-frame equivalent, so
// Android's auto-capture rides text recognition alone — which is why the text
// gate had to answer the framing question by itself and does so on both
// platforms. This is an ADDITIONAL signal on iOS, never a replacement:
//
//   • geometry answers "is it framed like a document"
//   • text answers "is it the RIGHT document"
//
// Aspect ratio cannot tell a passport from a driver's licence, so shooting on
// geometry alone would happily capture the wrong document. Both must agree.
//
// A build without this module simply reports nothing found, and auto-capture
// falls back to the text gate — the same null-degrade posture as the rest of
// the native surface.
// ---------------------------------------------------------------------------

export interface DetectedRect {
  /** Whether a rectangle was found at all. */
  found: boolean;
  /** Normalised 0..1 bounding box of the detected rectangle. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Width ÷ height of the detected shape — what identifies a card vs a page. */
  aspect: number;
  /** Detector confidence, 0..1. */
  confidence: number;
}

export interface MyazaRectDetector
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Find the most prominent document-like rectangle in a camera {@link Frame}.
   *
   * Called per-frame from the VisionCamera worklet, so the frame never crosses
   * the JS bridge — only the measured box comes back.
   *
   * Returns `found: false` when nothing qualifies, which is the ordinary case
   * while the user is still aiming.
   */
  detectRect(frame: Frame): DetectedRect;
}
