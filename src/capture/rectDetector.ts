import { NitroModules } from 'react-native-nitro-modules';
import type { BoxedHybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

import type { DetectedRect, MyazaRectDetector } from '../specs/MyazaRectDetector.nitro';

// ---------------------------------------------------------------------------
// Document EDGE detection — the geometry half of auto-capture.
//
// iOS only in practice: Apple Vision has a rectangle detector, ML Kit does not,
// and the Android implementation reports nothing found. Everything here is
// therefore written to degrade to "no opinion" rather than to block, so a
// platform without geometry captures exactly as it did before.
//
// Geometry NEVER decides alone. An aspect ratio cannot tell a passport from a
// driver's licence, so a capture that fired on shape would shoot the wrong
// document — the text gate is what establishes identity, and this only says
// whether what's there is presented like a document.
// ---------------------------------------------------------------------------

/**
 * Resolved LAZILY and re-tried until it appears.
 *
 * Creating it at module load fails silently and permanently when this module
 * evaluates before Nitro's registry is populated (Fast Refresh does this): the
 * reference stays null for the session and the geometry gate silently becomes a
 * no-op, which is indistinguishable from a platform that has no detector.
 *
 * The BOXED handle is what the worklet unboxes, so it is created alongside on
 * the JS thread — a worklet cannot construct one itself.
 */
function create(): MyazaRectDetector | null {
  try {
    return NitroModules.hasHybridObject('MyazaRectDetector')
      ? NitroModules.createHybridObject<MyazaRectDetector>('MyazaRectDetector')
      : null;
  } catch {
    return null;
  }
}

// EAGER, and it has to be — the worklet captures `boxed` at creation, so a null
// there is permanent on the camera thread and every frame reports no rectangle.
let detector: MyazaRectDetector | null = create();
// `let`, not `const`: if the eager create above ran before Nitro's registry was
// populated, `resolve()` re-creates AND re-boxes. Leaving this const meant a
// late resolution produced a working JS-side module with a null worklet handle
// — the camera thread stayed blind while everything looked fine from JS.
let boxed: BoxedHybridObject<MyazaRectDetector> | null = detector ? NitroModules.box(detector) : null;

function resolve(): MyazaRectDetector | null {
  if (!detector) {
    detector = create();
    if (detector) boxed = NitroModules.box(detector);
  }
  return detector;
}

/**
 * Whether this build can measure document edges at all.
 *
 * Also the WARM-UP: calling it resolves the module on the JS thread so the
 * boxed handle exists before the first frame reaches the worklet.
 */
export function hasRectDetector(): boolean {
  return resolve() !== null;
}

const NOT_FOUND: DetectedRect = {
  found: false, x: 0, y: 0, width: 0, height: 0, aspect: 0, confidence: 0,
};

/** Measure the document-like rectangle in a frame. A WORKLET. */
export function detectRectOnFrame(frame: Frame): DetectedRect {
  'worklet';
  if (boxed == null) return NOT_FOUND;
  try {
    return boxed.unbox().detectRect(frame);
  } catch {
    return NOT_FOUND;
  }
}

export { rectFramingProblem, type RectGateOptions, type MeasuredRect } from './rectGate';
