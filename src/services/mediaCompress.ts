import * as ImageManipulator from 'expo-image-manipulator';
import { Video } from 'react-native-compressor';

import {
  DOCUMENT_IMAGE_QUALITY,
  DOCUMENT_MAX_DIMENSION,
  SELFIE_IMAGE_QUALITY,
  VIDEO_COMPRESS_BITRATE,
  VIDEO_COMPRESS_MAX_SIZE,
} from '../config/captureSettings';
import { cardCropRect, type CropRect } from './cardCrop';

export type { CropRect } from './cardCrop';

/**
 * Transcodes a recorded clip down to a small evidence video (best-effort).
 * VisionCamera v5 records at the document camera's high-res 4K session format on
 * iOS and ignores the bitrate/resolution hints, so the raw file is far too large;
 * this shrinks it (mirrors the Flutter SDK's video_compress). On failure it returns
 * the original URI — the caller's size guard then drops it if still over the cap.
 */
export async function compressVideo(uri: string): Promise<string> {
  try {
    const out = await Video.compress(uri, {
      compressionMethod: 'manual',
      maxSize: VIDEO_COMPRESS_MAX_SIZE,
      bitrate: VIDEO_COMPRESS_BITRATE,
    });
    return out.startsWith('file://') ? out : `file://${out}`;
  } catch {
    return uri;
  }
}

// Post-capture still-image compression — the RN mirror of the Flutter SDK's
// media_compress_service.dart (and the web SDK's useImageCompress). Effort scales
// to need:
//   • DOCUMENT — conservative (OCR-critical): JPEG q0.9, only downscaled when the
//     longest edge exceeds DOCUMENT_MAX_DIMENSION, so small text stays legible.
//   • SELFIE   — moderate: JPEG q0.8, capped to ~1280 px.
// Runs natively via expo-image-manipulator (off the JS thread).

/**
 * The image's TRUE pixel dimensions.
 *
 * Measured through expo-image-manipulator — the same native module that does
 * the cropping — because the two must agree, and they did not.
 *
 * This used `Image.getSize`, which on Android reports DP (pixels ÷ display
 * density), while ImageManipulator crops in real pixels. On a density-2 phone
 * a 3048x4064 photo measured 1524x2032, so a crop rect computed as "centred"
 * was applied at half scale and landed in the UPPER-LEFT QUADRANT of the real
 * image. Every Android document capture cropped the wrong region — the card
 * the applicant framed was simply not in the stored photo. iOS was unaffected
 * (getSize returns pixels there), which is how an iPhone-led test history
 * never saw it. Found on a TECNO KM5 (density 320 → scale 2.0), 2026-09-20:
 * reported 1524x2032 against a true 3048x4064, a factor of exactly 2.
 *
 * Correcting by `PixelRatio.get()` would also work on today's devices, but it
 * re-states the cropper's units somewhere else and leaves the same class of
 * bug one refactor away. Asking the cropper itself cannot drift from it.
 */
export async function imageSize(uri: string): Promise<{ width: number; height: number }> {
  const ref = await ImageManipulator.ImageManipulator.manipulate(uri).renderAsync();
  return { width: ref.width, height: ref.height };
}

/**
 * Crop [uri] to [rect] (source-image pixels) and return a new high-quality JPEG
 * URI — the RN mirror of the Flutter SDK's `cropAndCompress` / `cropCardRegion`.
 * Kept near-lossless here (q0.95); OCR-grade sizing happens in
 * `compressDocumentImage` afterwards, exactly like Flutter.
 */
export async function cropImage(uri: string, rect: CropRect): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX: Math.round(rect.originX), originY: Math.round(rect.originY), width: Math.round(rect.width), height: Math.round(rect.height) } }],
    { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

/**
 * Crop a live-camera capture to the card-guide rectangle painted over the
 * viewfinder — the RN mirror of the Flutter SDK's `cropCardRegion`.
 *
 * The CameraViewfinder shows the preview `BoxFit.cover` inside a fixed 3:4 box,
 * with the guide centred at 88% width and `aspect` height (mirrors the SVG
 * overlay). So the crop is computed purely from the photo's pixel size + those
 * fractions — no absolute viewfinder size needed:
 *   1. the 3:4 box shows a centred 3:4 slice of the photo (cover),
 *   2. the guide is a sub-rect of that slice (88% wide, `aspect` ratio, centred).
 */
/**
 * Crop a live-camera capture to the card-guide rectangle painted over the
 * viewfinder — the RN mirror of the Flutter SDK's `cropCardRegion`. The
 * CameraViewfinder shows the preview `BoxFit.cover` in a fixed 3:4 box with the
 * guide centred at 88% width and `aspect` height (mirrors the SVG overlay).
 */
export async function cropCardRegion(
  uri: string,
  aspect: number,
  /** Aspect of the box the preview actually rendered in (width ÷ height). */
  viewAr?: number,
): Promise<string> {
  const { width, height } = await imageSize(uri);
  return cropImage(uri, cardCropRect(width, height, aspect, viewAr));
}

/** Compress a document still for OCR. Returns a new file URI. */
export async function compressDocumentImage(uri: string): Promise<string> {
  let actions: ImageManipulator.Action[] = [];
  try {
    const { width, height } = await imageSize(uri);
    const longest = Math.max(width, height);
    if (longest > DOCUMENT_MAX_DIMENSION) {
      actions = [
        width >= height
          ? { resize: { width: DOCUMENT_MAX_DIMENSION } }
          : { resize: { height: DOCUMENT_MAX_DIMENSION } },
      ];
    }
  } catch {
    /* size unknown — recompress without resizing */
  }
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: DOCUMENT_IMAGE_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

/** Compress a selfie still (moderate). Returns a new file URI. */
export async function compressSelfieImage(uri: string): Promise<string> {
  let actions: ImageManipulator.Action[] = [];
  try {
    const { width, height } = await imageSize(uri);
    const longest = Math.max(width, height);
    if (longest > 1280) {
      actions = [
        width >= height ? { resize: { width: 1280 } } : { resize: { height: 1280 } },
      ];
    }
  } catch {
    /* size unknown — recompress without resizing */
  }
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: SELFIE_IMAGE_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}
