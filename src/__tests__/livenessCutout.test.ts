import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CUTOUT_ASPECT,
  LIVENESS_FLAT_TINT,
  LIVENESS_TINT,
  livenessCutout,
  surroundPath,
  windowOutline,
  windowRect,
} from '../lib/livenessCutout';
import { faceWindowFor, faceWindowGuidance } from '../lib/faceWindow';

// The full-screen liveness camera's window, and the face judged against it.
// The same rules, and the same vectors, as the Flutter SDK's
// face_window_test.dart and liveness_immersive_test.dart.

describe('livenessCutout', () => {
  it('is capped on a tall phone and keeps the face shape', () => {
    const w = livenessCutout({ width: 440, height: 956 });
    expect(w.width).toBe(280);
    expect(w.height).toBeCloseTo(280 * CUTOUT_ASPECT);
  });

  it('is bounded by the height on a short phone, down to its floor', () => {
    expect(livenessCutout({ width: 320, height: 568 }).width).toBe(200);
  });

  it('follows the box it is given, not the screen', () => {
    // An iOS pageSheet is shorter than the display.
    const sheet = livenessCutout({ width: 390, height: 700 });
    const screen = livenessCutout({ width: 390, height: 844 });
    expect(sheet.width).toBeLessThan(screen.width);
  });
});

describe('the progress line', () => {
  const window = { width: 280, height: 370 };

  it('the outline starts at twelve o clock and is as long as the window edge', () => {
    const { d, length } = windowOutline(window, 2);
    expect(d.startsWith('M140 2 ')).toBe(true);
    // Two half-circles of radius 138 and two straight sides of 366 - 276.
    expect(length).toBeCloseTo(2 * Math.PI * 138 + 2 * 90);
  });
});

describe('faceWindow', () => {
  const window = faceWindowFor({
    frame: { width: 440, height: 956 },
    window: { width: 280, height: 369.6 },
    frameAspect: 9 / 16,
  });

  it('is a share of the frame as it is drawn', () => {
    expect(window.width).toBeCloseTo(280 / 537.75, 3);
    expect(window.height).toBeCloseTo(369.6 / 956, 3);
  });

  it('a face that sits in the window needs nothing', () => {
    expect(faceWindowGuidance(window, { width: window.width * 0.65, centreX: 0.5, centreY: 0.5 })).toBeNull();
  });

  it('a face spilling over the window is too close', () => {
    expect(faceWindowGuidance(window, { width: window.width, centreX: 0.5, centreY: 0.5 })).toBe('too_close');
  });

  it('a small face is too far', () => {
    expect(faceWindowGuidance(window, { width: window.width * 0.3, centreX: 0.5, centreY: 0.5 })).toBe('too_far');
  });

  it('a face beside the window is off centre, on either axis', () => {
    const width = window.width * 0.65;
    expect(faceWindowGuidance(window, { width, centreX: 0.5 + window.width * 0.3, centreY: 0.5 })).toBe('off_centre');
    expect(faceWindowGuidance(window, { width, centreX: 0.5, centreY: 0.5 - window.height * 0.3 })).toBe('off_centre');
  });

  it('a detector that reports no centre cannot say the face drifted', () => {
    expect(faceWindowGuidance(window, { width: window.width * 0.65 })).toBeNull();
  });

  it('a turn or a nod may leave the centre and measure narrower', () => {
    expect(
      faceWindowGuidance(window, { width: window.width * 0.3, centreX: 0.8, centreY: 0.5, moving: true }),
    ).toBeNull();
    expect(faceWindowGuidance(window, { width: window.width, moving: true })).toBe('too_close');
  });
});

// ─── The blur around the window ─────────────────────────────────────────────
//
// The blur is a native view. What can be pinned here is the shape it is told
// to leave out, and the handful of wiring rules that are silently reversible
// in an edit and only ever show up on a phone as "the blur is gone".
describe('the blur around the window', () => {
  const read = (rel: string): string => readFileSync(join(__dirname, '..', rel), 'utf8');

  it('centres the window across, and drops it by what the frame is short of', () => {
    const frame = { width: 390, height: 844 };
    const rect = windowRect(frame);
    expect(rect.x + rect.width / 2).toBeCloseTo(frame.width / 2);
    // At the centre: the picture stands between the back and close buttons,
    // so this phone has all the room wanted above the window.
    expect(rect.y + rect.height / 2).toBeCloseTo(frame.height / 2);
    expect({ width: rect.width, height: rect.height }).toEqual(livenessCutout(frame));
  });

  it('paints the tint through the frame with the window left out', () => {
    const frame = { width: 400, height: 800 };
    const d = surroundPath(frame, { x: 100, y: 200, width: 200, height: 264 });
    // The whole frame, then the window as a second closed shape: an even-odd
    // fill leaves the second one empty.
    expect(d.startsWith('M0 0H400V800H0Z ')).toBe(true);
    expect(d).toContain('M100 300 A100 100 0 0 1 300 300 V364');
    expect(d.endsWith('Z')).toBe(true);
  });

  it('is not mounted, and the tint is heavier, where the phone cannot blur', () => {
    const backdrop = read('screens/liveness/Backdrop.tsx');
    expect(backdrop).toContain('{backdropBlurSupported && window ? (');
    expect(backdrop).toContain(': LIVENESS_FLAT_TINT');
    expect(LIVENESS_FLAT_TINT).toBeGreaterThan(LIVENESS_TINT);
    expect(read('components/BackdropBlur.tsx')).toContain('Number(Platform.Version) >= 31');
  });

  it('keeps the camera in a child the blur can hold on to', () => {
    // Android records the view just before the blur ONCE and follows what is
    // drawn inside its child. Two real, never-swapped views are what that
    // rests on: flatten either and the blur holds a view that is gone.
    const backdrop = read('screens/liveness/Backdrop.tsx');
    expect(backdrop.match(/<View style=\{StyleAbsFill\} collapsable=\{false\}>/g)).toHaveLength(2);
    expect(backdrop.indexOf('{camera}')).toBeLessThan(backdrop.indexOf('<BackdropBlur'));
  });

  it('draws the blurred camera in a TextureView on Android', () => {
    // A SurfaceView sits behind the app's window, where nothing can blur it.
    expect(read('screens/liveness/LivenessLive.tsx')).toContain('texture={backdropNeedsTexture}');
    expect(read('screens/liveness/LivenessCamera.tsx')).toContain(
      "implementationMode={texture ? 'compatible' : undefined}",
    );
  });

  it('judges the face against the window inside the full frame', () => {
    const step = read('screens/LivenessStep.tsx');
    expect(step).toContain('window: livenessCutout(frame),');
    // ...and wherever the window sits: the same drop the frame draws it with.
    expect(step).toContain('drop: windowDrop(frame, livenessCutout(frame), topInsetRef.current),');
    expect(read('screens/liveness/ImmersiveFrame.tsx')).toContain('windowRect(size, insets.top)');
  });
});

describe('the gesture picture on a short screen', () => {
  it('is full size with room, shrinks with less, and never disappears into the pill', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { gestureSize, GESTURE_MIN_SIZE } = require('../lib/livenessCutout');
    expect(gestureSize(220, 76)).toBe(76);
    expect(gestureSize(150, 76)).toBe(76);
    expect(gestureSize(120, 76)).toBe(56);
    expect(gestureSize(90, 76)).toBe(GESTURE_MIN_SIZE);
    expect(gestureSize(0, 76)).toBe(GESTURE_MIN_SIZE);
    expect(gestureSize(220, 52)).toBe(GESTURE_MIN_SIZE);
    expect(gestureSize(170, 96)).toBe(96);
    expect(gestureSize(140, 96)).toBe(74);
  });
});

// The same vectors as the web and Flutter SDKs' tests.
describe('windowDrop', () => {
  const { windowDrop, WINDOW_MAX_DROP, aboveHeight } = require('../lib/livenessCutout');
  const { faceWindowFor, faceWindowGuidance } = require('../lib/faceWindow');

  it('counts the status bar in the room wanted above', () => {
    const frame = { width: 360, height: 780 };
    const window = { width: 264, height: 348.48 };
    expect(windowDrop(frame, window)).toBe(0);
    expect(windowDrop(frame, window, 36)).toBe(10);
  });

  it('leaves the window at the centre on a tall phone', () => {
    expect(windowDrop({ width: 440, height: 956 }, { width: 280, height: 369.6 })).toBe(0);
  });

  it('drops it on a short phone, by no more than the cap', () => {
    expect(windowDrop({ width: 375, height: 667 }, { width: 232, height: 306.82 })).toBe(10);
    expect(windowDrop({ width: 320, height: 568 }, { width: 198, height: 261.28 })).toBe(17);
    expect(windowDrop({ width: 320, height: 480 }, { width: 200, height: 264 }, 60)).toBe(0);
    expect(windowDrop({ width: 360, height: 700 }, { width: 244, height: 322.08 }, 100)).toBe(WINDOW_MAX_DROP);
  });

  it('never takes the room the step count needs below', () => {
    expect(windowDrop({ width: 320, height: 400 }, { width: 139, height: 184 })).toBe(0);
  });

  it('moves the window and the face check with it', () => {
    const frame = { width: 320, height: 568 };
    const window = livenessCutout(frame);
    const drop = windowDrop(frame, window);
    expect(windowRect(frame).y).toBeCloseTo((frame.height - window.height) / 2 + drop, 5);
    const face = faceWindowFor({ frame, window, frameAspect: 9 / 16, drop });
    expect(face.centreY).toBeGreaterThan(0.5);
    // A face on the window's own middle is centred; one on the frame's middle
    // of a tall window is still inside the allowed drift.
    expect(faceWindowGuidance(face, { faceWidth: face.width * 0.6, centreX: 0.5, centreY: face.centreY })).toBeNull();
    expect(
      faceWindowGuidance(face, { faceWidth: face.width * 0.6, centreX: 0.5, centreY: face.centreY - face.height * 0.3 }),
    ).toBe('off_centre');
    expect(aboveHeight(96)).toBe(122);
    expect(aboveHeight(180)).toBe(180);
  });
});
