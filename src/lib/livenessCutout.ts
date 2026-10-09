// ---------------------------------------------------------------------------
// The face window of the full-screen liveness camera, and the tint around it.
//
// The camera owns the display. A tall, round-ended window at the exact centre
// of the frame shows it sharp; everything around the window is the same
// camera blurred, under a tint of the flow's own background colour
// (screens/liveness/Backdrop). The blur is the SDK's own native view
// (components/BackdropBlur).
//
// Its size is worked out from the box the camera is ACTUALLY drawn in (the
// frame's own layout), never the screen: on iOS the sheet is a pageSheet,
// shorter than the display, and the two disagree.
//
// Mirrors the Flutter SDK's screens/liveness_cutout.dart. Change a number in
// one and change both; the vectors in __tests__/livenessCutout.test.ts are the
// Flutter test's own.
// ---------------------------------------------------------------------------

export const CUTOUT_MAX_WIDTH = 280;
export const CUTOUT_MIN_WIDTH = 200;

/** A face is taller than it is wide. */
export const CUTOUT_ASPECT = 1.32;

/**
 * The room above the window at which the gesture picture is drawn at its full
 * size (and, with 70 more, the long lighting note fits above it).
 */
export const ROOM_FOR_GESTURE = 150;

/** The gesture picture's smallest side. Under this the drawing is too small
 *  to follow at arm's length. */
export const GESTURE_MIN_SIZE = 56;
/** What the instruction's pill and the gap under the picture take of the room. */
export const GESTURE_PILL_ROOM = 66;

/** The gesture picture at its full size, where there is the room for it. */
export const GESTURE_FULL_SIZE = 96;

/**
 * The side of the gesture picture for the room it has: from the top of the
 * back and close buttons (it stands between them) down to the window. The picture
 * ALWAYS stands on its own above the instruction: on a short phone it used to
 * move inside the instruction's pill, where it was 28 points across and easy
 * to miss beside the words. It now shrinks with the room instead, down to
 * GESTURE_MIN_SIZE, and never past [full].
 */
export function gestureSize(room: number, full: number): number {
  return Math.max(GESTURE_MIN_SIZE, Math.min(full, Math.floor(room - GESTURE_PILL_ROOM)));
}

/**
 * The height of the block above the window. On a phone too short for even the
 * smallest picture and its instruction, the block keeps that height and runs
 * over the window's top edge (the hair, not the face) instead of shrinking the
 * picture further.
 */
export function aboveHeight(room: number): number {
  return Math.max(room, GESTURE_MIN_SIZE + GESTURE_PILL_ROOM);
}

/**
 * How much of the flow's background colour lies over the blurred camera
 * around the window, in a well-lit room. A real blur under a thin tint: the
 * blur moves the eye to the window, the tint only evens the background out.
 */
export const LIVENESS_TINT = 0.16;

/**
 * The tint in a dark room. The step is lit so the SCREEN lights the face, and
 * a thin tint over a dark room is a dark screen: this hands most of the
 * display back to the light background.
 */
export const LIVENESS_DIM_ROOM_TINT = 0.66;

/**
 * The tint where the phone cannot blur (Android before 12). With nothing
 * softening the room behind it, the tint has to do the quietening alone.
 */
export const LIVENESS_FLAT_TINT = 0.74;

export interface Size {
  width: number;
  height: number;
}

/** A box inside the frame, in the frame's own coordinates. */
export interface Rect extends Size {
  x: number;
  y: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** The window: as wide as the frame allows, bounded by the height so the
 *  instruction above and whatever sits below keep their room. */
export function livenessCutout(frame: Size): Size {
  const width = clamp(
    Math.min(frame.width - 96, (frame.height * 0.46) / CUTOUT_ASPECT, CUTOUT_MAX_WIDTH),
    CUTOUT_MIN_WIDTH,
    CUTOUT_MAX_WIDTH,
  );
  return { width, height: width * CUTOUT_ASPECT };
}

/**
 * The window's own outline, starting at twelve o'clock and running clockwise,
 * with its length: what the progress line is drawn along. [inset] pulls the
 * line in by half its stroke so it sits on the edge rather than across it.
 */
export function windowOutline(window: Size, inset: number): { d: string; length: number } {
  const w = window.width - inset * 2;
  const h = window.height - inset * 2;
  const r = w / 2;
  const x0 = inset;
  const y0 = inset;
  const x1 = x0 + w;
  const y1 = y0 + h;
  const cx = x0 + r;
  const d =
    `M${cx} ${y0} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} ` +
    `A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${cx} ${y0}`;
  return { d, length: 2 * Math.PI * r + 2 * (h - w) };
}

// The window sits a little BELOW the centre on a short screen, and only by
// what the block above it is short of. That block is the gesture picture and
// the instruction. The picture is narrow and centred, so it rises into the gap
// BETWEEN the back and close buttons (ImmersiveFrame); only the instruction,
// which is wide, has to stay under them. The window used to be dropped to fit
// the picture under the buttons too, which on a short phone pushed the face
// well below the middle and still left a small picture. The face is judged
// against the window wherever it sits (faceWindowFor takes the drop).
/** The room wanted above the window, from the top inset down: the gap over the
 *  picture (8), the picture on its plate (108), the gap under it (8), the
 *  instruction (46) and the gap over the window (20). */
export const WINDOW_TOP_ROOM = 190;
/** What must stay below the window: the gap under it, the retry panel a failed
 *  check shows there (its words and its button), and the gap to the edge. It
 *  was sized for the step count alone, and the panel was cut off. */
export const WINDOW_BELOW_KEEP = 136;
/** The furthest the window drops. More reads as off-centre. */
export const WINDOW_MAX_DROP = 48;

/**
 * How far below the centre the window sits, for a frame and its window.
 * [topInset] is what the frame must keep clear of at its top (the status bar).
 */
export function windowDrop(frame: Size, window: Size, topInset = 0): number {
  const margin = (frame.height - window.height) / 2;
  const wanted = WINDOW_TOP_ROOM + topInset - margin;
  const spare = margin - WINDOW_BELOW_KEEP;
  return Math.round(Math.max(0, Math.min(wanted, spare, WINDOW_MAX_DROP)));
}

/** Where the window sits: centred across, and a little below the centre on a short screen. */
export function windowRect(frame: Size, topInset = 0): Rect {
  const window = livenessCutout(frame);
  return {
    x: (frame.width - window.width) / 2,
    y: (frame.height - window.height) / 2 + windowDrop(frame, window, topInset),
    ...window,
  };
}

/**
 * Everything in the frame but the window, as one path for an even-odd fill:
 * what the tint is painted through.
 */
export function surroundPath(frame: Size, window: Rect): string {
  const r = window.width / 2;
  const x1 = window.x + window.width;
  const y1 = window.y + window.height;
  return (
    `M0 0H${frame.width}V${frame.height}H0Z ` +
    `M${window.x} ${window.y + r} A${r} ${r} 0 0 1 ${x1} ${window.y + r} V${y1 - r} ` +
    `A${r} ${r} 0 0 1 ${window.x} ${y1 - r}Z`
  );
}
