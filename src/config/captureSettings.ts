// ===========================================================================
// Capture & encoding settings — compression strategy
// ===========================================================================
//
// Mirrors the web SDK's `lib/capture-settings.ts` and the Flutter SDK's
// `CaptureConfig`. Effort is scaled to how much quality each artifact needs:
//
//   • VIDEO (liveness + document)  — AGGRESSIVE: low res + low frame rate +
//       a ~500 kbps bitrate cap. A few seconds stays well under the size target.
//   • SELFIE still image           — MODERATE: 640×480, JPEG quality 0.8.
//   • DOCUMENT still image         — CONSERVATIVE (OCR-critical): captured at a
//       higher resolution, JPEG quality 0.9, never downscaled below 1080 px.
// ===========================================================================

// --- Liveness / selfie camera (video is recorded from this stream) ---------
export const CAPTURE_WIDTH = 640;
export const CAPTURE_HEIGHT = 480;

// --- Document camera (higher res so the OCR still stays readable) ----------
export const DOCUMENT_CAPTURE_WIDTH = 1920;
export const DOCUMENT_CAPTURE_HEIGHT = 1080;

// --- Frame rate (applies to every recorded stream) -------------------------
export const CAPTURE_FRAMERATE = 15;
export const CAPTURE_FRAMERATE_MAX = 20;

// --- Video size strategy (liveness + document) -----------------------------
// These videos are EVIDENCE ONLY — they're not compared against anything and may
// never be looked at, so we optimise purely for small file size (low res + low
// frame rate + low bitrate). Every clip must stay under MAX_VIDEO_BYTES (5 MB);
// the recorder also stops at MAX_VIDEO_DURATION_MS and the uploader skips anything
// still over the cap, so a video can never exceed 5 MB regardless of how long the
// user lingers on the camera.
export const LIVENESS_VIDEO_BITRATE = 350_000; // 350 kbps
export const DOCUMENT_VIDEO_BITRATE = 350_000; // 350 kbps

/** Recorded video resolution — small (360p-ish). Quality is irrelevant here. */
export const VIDEO_CAPTURE_RESOLUTION = { width: 360, height: 640 } as const;

// NOTE: VisionCamera v5 does NOT honour targetBitRate / targetResolution for
// recordings on iOS — the whole session uses ONE camera format, driven by the
// document photo output's `quality` prioritisation (4K, for OCR), so the raw clip
// is huge (a 6s capture was ~35 MB). We therefore TRANSCODE every recorded clip
// down with react-native-compressor before upload (see services/mediaCompress
// `compressVideo`) — the real file-size lever. The raw recording is duration-capped
// only to bound the temp file we hand to the transcoder.
export const MAX_VIDEO_DURATION_MS = 12_000; // bounds the raw 4K temp file

/** Transcode target — longest edge (≈480p) and bitrate for the uploaded clip. */
export const VIDEO_COMPRESS_MAX_SIZE = 640;
export const VIDEO_COMPRESS_BITRATE = 600_000; // 600 kbps → 12s ≈ 0.9 MB

/** Hard upload ceiling — any video still over this (transcode failed) is dropped. */
export const MAX_VIDEO_BYTES = 5 * 1024 * 1024; // 5 MB

/** Pause before the liveness selfie shutter so the user steadies after the final
 *  gesture (a head turn leaves them mid-motion) → a sharper, non-blurred selfie. */
export const SELFIE_SETTLE_MS = 1500;

// --- Still-image JPEG quality (0–1) ----------------------------------------
export const SELFIE_IMAGE_QUALITY = 0.8; // moderate
export const DOCUMENT_IMAGE_QUALITY = 0.9; // conservative — keep text sharp

/** Document stills are never scaled narrower than this (OCR-critical). */
export const DOCUMENT_MIN_WIDTH = 1080;
/** Upper bound for document stills — large enough to keep small text legible. */
export const DOCUMENT_MAX_DIMENSION = 2000;
