// ─── Was the selfie sharp enough? Measured the moment it is taken ────────────
//
// The React Native mirror of the web SDK's lib/selfie-sharpness.ts and the
// Flutter SDK's utils/selfie_sharpness.dart. Keep the three in lockstep: the
// floor, the crop fraction and the measuring size are what make a score mean
// the same thing on every platform.
//
// The server can already say a failed face check was caused by a blurry
// selfie, but that reaches the applicant by webhook long after the phone is
// back in a pocket. The review screen is the one place a retake costs two
// seconds, so the same question is asked here.
//
// A NOTICE, NEVER A GATE. The floor was not calibrated on real phone captures,
// and a wrong floor on a gate would trap a genuine applicant in a retake loop.
// As a notice the cost of a wrong floor is one sentence the applicant can
// ignore: Continue stays available whatever this says. The server follows the
// same rule, where capture quality explains a failure and never causes one.
//
// MEASURED ON THE FACE, NOT THE FRAME. Auto-capture only fires once the face is
// centred and fills a good part of the frame, so the centre of the still IS the
// face. A centred square is also unchanged by a 90 degree rotation or a mirror,
// so EXIF orientation cannot move the measurement onto the room.
//
// The crop and the resize run natively in Nitro Image, so JS only ever reads
// 160 by 160 pixels, never the full still.

/** Below this, the notice shows. A starting value, biased toward NOT showing. */
export const SELFIE_SHARPNESS_FLOOR = 18;

/** Share of the shorter side the centre crop takes. */
export const SELFIE_CROP_FRACTION = 0.5;

/**
 * The crop is resized to a FIXED size before measuring, because Laplacian
 * variance scales with resolution: without it the score would measure the
 * phone's camera rather than the photograph.
 */
export const SELFIE_MEASURE_SIZE = 160;

/**
 * Variance of the 4-neighbour Laplacian over a single-channel plane.
 *
 * Blur is a low-pass filter, so it flattens second derivatives, so the spread
 * of the Laplacian response collapses. Variance rather than mean, because the
 * mean of a Laplacian is near zero on any image, sharp or not. The same measure
 * the server runs, so the two readings can be compared.
 */
export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number): number {
  // Interior pixels only: the kernel needs all four neighbours.
  if (width < 3 || height < 3 || gray.length < width * height) return 0;

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const i = row + x;
      const v = gray[i - width]! + gray[i + width]! + gray[i - 1]! + gray[i + 1]! - 4 * gray[i]!;
      sum += v;
      sumSq += v * v;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return Math.round((sumSq / n - mean * mean) * 100) / 100;
}

/** A centred square covering `fraction` of the shorter side. */
export function centreCrop(
  width: number,
  height: number,
  fraction: number = SELFIE_CROP_FRACTION,
): { sx: number; sy: number; sw: number; sh: number } {
  const side = Math.max(1, Math.round(Math.min(width, height) * fraction));
  return {
    sx: Math.max(0, Math.round((width - side) / 2)),
    sy: Math.max(0, Math.round((height - side) / 2)),
    sw: side,
    sh: side,
  };
}

/**
 * Whether to show the notice. An unmeasurable selfie is NOT blurry: "we could
 * not look" is not evidence the photograph was soft, and saying so would ask a
 * person to retake a photo that may be perfectly good.
 */
export function isSelfieBlurry(score: number | null): boolean {
  return score != null && score < SELFIE_SHARPNESS_FLOOR;
}

// Where each colour channel sits, per Nitro Image's `pixelFormat`, which names
// the BYTE order of the buffer it hands back.
const CHANNELS: Record<string, { r: number; g: number; b: number; bpp: number }> = {
  RGBA: { r: 0, g: 1, b: 2, bpp: 4 },
  RGBX: { r: 0, g: 1, b: 2, bpp: 4 },
  BGRA: { r: 2, g: 1, b: 0, bpp: 4 },
  BGRX: { r: 2, g: 1, b: 0, bpp: 4 },
  ARGB: { r: 1, g: 2, b: 3, bpp: 4 },
  XRGB: { r: 1, g: 2, b: 3, bpp: 4 },
  ABGR: { r: 3, g: 2, b: 1, bpp: 4 },
  XBGR: { r: 3, g: 2, b: 1, bpp: 4 },
  RGB: { r: 0, g: 1, b: 2, bpp: 3 },
  BGR: { r: 2, g: 1, b: 0, bpp: 3 },
};

/**
 * Rec. 601 luminance from a raw pixel buffer, or null for a layout we cannot
 * read. The stride is taken from the buffer itself, because a platform may pad
 * rows and assuming a tight buffer would shear the image diagonally.
 */
export function grayFromPixels(
  buffer: ArrayBuffer,
  width: number,
  height: number,
  pixelFormat: string,
): Uint8Array | null {
  const layout = Object.prototype.hasOwnProperty.call(CHANNELS, pixelFormat)
    ? CHANNELS[pixelFormat]
    : undefined;
  if (!layout || width < 1 || height < 1) return null;
  const bytes = new Uint8Array(buffer);
  const stride = Math.floor(bytes.length / height);
  if (stride < width * layout.bpp) return null;

  const gray = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    for (let x = 0; x < width; x += 1) {
      const i = row + x * layout.bpp;
      gray[y * width + x] = Math.round(
        0.299 * bytes[i + layout.r]! + 0.587 * bytes[i + layout.g]! + 0.114 * bytes[i + layout.b]!,
      );
    }
  }
  return gray;
}

/** Nitro Image wants a filesystem path, never a `file://` URL. */
export function fileUriToPath(uri: string): string {
  if (!uri.startsWith('file://')) return uri;
  const path = uri.slice('file://'.length);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export interface RawPixels {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  pixelFormat: string;
}

export interface NitroImageLike {
  width: number;
  height: number;
  cropAsync(startX: number, startY: number, endX: number, endY: number): Promise<NitroImageLike>;
  resizeAsync(width: number, height: number): Promise<NitroImageLike>;
  toRawPixelDataAsync(allowGpu?: boolean): Promise<RawPixels>;
}

export interface ImageFactoryLike {
  loadFromFileAsync(filePath: string): Promise<NitroImageLike>;
}

let factory: ImageFactoryLike | null | undefined;

// Resolved once. A require that failed (a test runner, an install whose native
// module did not link) will fail again, and the answer is the same: no notice.
function loadImages(): ImageFactoryLike | null {
  if (factory === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('react-native-nitro-image') as { Images?: ImageFactoryLike };
      factory = mod?.Images ?? null;
    } catch {
      factory = null;
    }
  }
  return factory;
}

/**
 * Load the still, measure its centre. Null on any failure.
 *
 * `images` exists so a test can hand in a fake; callers never pass it.
 */
export async function measureSelfieSharpness(
  uri: string,
  images: ImageFactoryLike | null = loadImages(),
): Promise<number | null> {
  if (!images) return null;
  try {
    const still = await images.loadFromFileAsync(fileUriToPath(uri));
    if (!still.width || !still.height) return null;
    // Nitro's crop takes END coordinates, not a width and height.
    const c = centreCrop(still.width, still.height);
    const face = await still.cropAsync(c.sx, c.sy, c.sx + c.sw, c.sy + c.sh);
    const small = await face.resizeAsync(SELFIE_MEASURE_SIZE, SELFIE_MEASURE_SIZE);
    const raw = await small.toRawPixelDataAsync();
    const gray = grayFromPixels(raw.buffer, raw.width, raw.height, raw.pixelFormat);
    return gray ? laplacianVariance(gray, raw.width, raw.height) : null;
  } catch {
    return null;
  }
}
