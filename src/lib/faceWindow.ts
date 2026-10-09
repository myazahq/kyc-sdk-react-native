// ---------------------------------------------------------------------------
// Is the face inside the window?
//
// In the sheet the camera circle shows the whole frame, so "the face is a
// sensible size in the frame" is the same statement as "the face sits in the
// circle". Full screen that stops being true: the frame fills the display and
// the window shows only its middle, so a face can be a fine size for the frame
// and still spill over the window's edge, or sit beside it. These rules judge
// the face against the WINDOW.
//
// Everything is in shares of the camera frame (0..1), which is what the face
// detector reports. A port of the Flutter SDK's liveness/face_window.dart:
// change a rule in one and change both.
// ---------------------------------------------------------------------------

/** The window, as shares of the camera frame's width and height. Centred
 *  across; [centreY] is where its middle sits down the frame (0.5 when absent:
 *  the window drops a little below the centre on a short screen). */
export interface FaceWindow {
  width: number;
  height: number;
  centreY?: number;
}

/** A face wider than this share of the window is spilling over its edges. */
export const FACE_WINDOW_MAX_FILL = 0.84;
/** A face narrower than this share of the window is too far to judge. */
export const FACE_WINDOW_MIN_FILL = 0.46;
/** How far the face's centre may sit from the window's, as a share of the
 *  window's own width and height. */
export const FACE_WINDOW_MAX_DRIFT = 0.2;

export type FaceWindowGuidance = 'too_close' | 'too_far' | 'off_centre';

/**
 * How much of the frame the window covers, and where its middle sits, for a
 * frame of [frameAspect] (width over height, upright) drawn cover-fit in
 * [frame] with [window] centred across and [drop] points below the centre.
 */
export function faceWindowFor(input: {
  frame: { width: number; height: number };
  window: { width: number; height: number };
  frameAspect: number;
  drop?: number;
}): FaceWindow {
  const shownWidth = Math.max(input.frame.width, input.frame.height * input.frameAspect);
  const shownHeight = shownWidth / input.frameAspect;
  return {
    width: input.window.width / shownWidth,
    height: input.window.height / shownHeight,
    centreY: 0.5 + (input.drop ?? 0) / shownHeight,
  };
}

/**
 * What to ask of the person, or null when the face sits well in the window.
 * Distance first: a face that is too big cannot be centred into the window
 * anyway.
 *
 * `moving` is a turn or a nod in progress. The head is MEANT to leave the
 * centre then, and a turned face measures narrower, so only "too close" stays
 * strict; holding those gestures to the still rules would pause the very
 * movement being asked for.
 */
export function faceWindowGuidance(
  window: FaceWindow,
  face: { width: number; centreX?: number; centreY?: number; moving?: boolean },
): FaceWindowGuidance | null {
  if (face.width > window.width * FACE_WINDOW_MAX_FILL) return 'too_close';
  const minFill = face.moving ? FACE_WINDOW_MIN_FILL / 2 : FACE_WINDOW_MIN_FILL;
  if (face.width < window.width * minFill) return 'too_far';
  if (face.moving) return null;
  // A detector that reports no centre cannot say the face has drifted.
  if (face.centreX != null && Math.abs(face.centreX - 0.5) > window.width * FACE_WINDOW_MAX_DRIFT) {
    return 'off_centre';
  }
  const middle = window.centreY ?? 0.5;
  if (face.centreY != null && Math.abs(face.centreY - middle) > window.height * FACE_WINDOW_MAX_DRIFT) {
    return 'off_centre';
  }
  return null;
}
