// ---------------------------------------------------------------------------
// Silent capture: up to three unposed photos of the applicant.
//
// Taken during DOCUMENT CAPTURE only, never on the liveness step. The document
// is shot with the rear camera, so on the review screen (the rear camera is
// closed by then and the person is looking at their photo) the SDK briefly
// opens the FRONT camera with no preview and takes one frame: no extra
// permission prompt (camera access is already granted), nothing on screen, no
// shutter sound, no flash, no delay to the flow. A reviewer sees who was
// holding the ID. Uploaded as media type `silent_capture`, submitted as
// `mediaIds.silentCapture1..3` and described in `metadata.device.silentCapture`.
//
// Pure: the rules only (whether it applies, the cap, the slots, the wire
// shape). The document step owns the camera and the timing
// (screens/document/useSilentFrontCapture). MIRRORS the web SDK's
// `lib/silent-capture.ts` and the Flutter SDK's `silent_capture.dart`; keep the
// rules identical: document capture only, never on a scoped flow, a cap of 3,
// 1-based slots in capture order with no gaps, and an absent flag means ON.
// ---------------------------------------------------------------------------

import { configScope, type WorkflowScope } from './scope';

/** Never more than this many frames per verification, retakes included. */
export const SILENT_CAPTURE_MAX = 3;

/** Where in the flow a frame was taken. Only document capture takes them;
 *  the wire vocabulary also has `'selfie'`, which older builds still send. */
export type SilentCaptureMoment = 'document';

/** One frame the SDK took. `mediaId` stays null while the upload runs and
 *  after an upload that failed, so only uploaded frames are submitted. */
export interface SilentCaptureFrame {
  moment: SilentCaptureMoment;
  /** ISO timestamp of the moment the frame was taken. */
  capturedAt: string;
  mediaId: string | null;
}

/** One entry of `metadata.device.silentCapture`. */
export interface SilentCaptureDeviceEntry {
  slot: number;
  moment: SilentCaptureMoment;
  capturedAt: string;
}

export interface SilentCaptureSubmission {
  /** `silentCapture1`, `silentCapture2`, `silentCapture3`, no gaps. */
  mediaIds: Record<string, string>;
  device: SilentCaptureDeviceEntry[];
}

/**
 * Whether this flow takes silent frames at all. Absent (or anything but
 * `false`) is ON. No scoped flow captures a document, so none takes any.
 */
export function silentCaptureEnabled(config: {
  silentCapture?: boolean | null;
  scope?: WorkflowScope | string;
}): boolean {
  if (config.silentCapture === false) return false;
  return configScope(config) === null;
}

/** How long after the review appears the front camera opens: the rear
 *  camera's session has to finish closing first. */
export const SILENT_FRONT_OPEN_DELAY_MS = 400;

/** How long the front camera runs before the frame is taken: long enough
 *  for auto-exposure to settle on a face, short enough to finish while the
 *  person is still reading the review. */
export const SILENT_DOCUMENT_SETTLE_MS = 900;

/** The mediaIds key a slot is submitted under. */
export function silentCaptureMediaKey(slot: number): string {
  return `silentCapture${slot}`;
}

/**
 * Reserve the next frame, BEFORE it is taken, so two captures racing each
 * other can never share a slot or pass the cap. Null when the cap is reached.
 * Frames already taken are kept whatever happens to their upload, and count
 * towards the cap: a retake never takes more than three in total.
 */
export function reserveSilentFrame(
  frames: readonly SilentCaptureFrame[],
  moment: SilentCaptureMoment,
  capturedAt: string,
): { frames: SilentCaptureFrame[]; index: number } | null {
  if (frames.length >= SILENT_CAPTURE_MAX) return null;
  return { frames: [...frames, { moment, capturedAt, mediaId: null }], index: frames.length };
}

/**
 * Record a frame's upload outcome (the mediaId, or null when it failed). The
 * frame is named by its index AND its capture time, so an upload that lands
 * after the flow was reset can never settle a frame of the next verification.
 */
export function settleSilentFrame(
  frames: readonly SilentCaptureFrame[],
  index: number,
  capturedAt: string,
  mediaId: string | null,
): SilentCaptureFrame[] {
  if (frames[index]?.capturedAt !== capturedAt) return [...frames];
  return frames.map((f, i) => (i === index ? { ...f, mediaId } : f));
}

/**
 * The frames as the submission carries them: only the uploaded ones, in
 * capture order, renumbered from 1 so a failed upload leaves no gap. Null when
 * nothing was uploaded, so the request carries no empty block.
 */
export function silentCaptureSubmission(
  frames: readonly SilentCaptureFrame[],
): SilentCaptureSubmission | null {
  const uploaded = frames
    .filter((f): f is SilentCaptureFrame & { mediaId: string } => !!f.mediaId)
    .slice(0, SILENT_CAPTURE_MAX);
  if (uploaded.length === 0) return null;
  const mediaIds: Record<string, string> = {};
  const device: SilentCaptureDeviceEntry[] = [];
  uploaded.forEach((f, i) => {
    const slot = i + 1;
    mediaIds[silentCaptureMediaKey(slot)] = f.mediaId;
    device.push({ slot, moment: f.moment, capturedAt: f.capturedAt });
  });
  return { mediaIds, device };
}
