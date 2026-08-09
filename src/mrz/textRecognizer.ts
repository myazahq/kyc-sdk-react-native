import { NitroModules } from 'react-native-nitro-modules';
import type { BoxedHybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

import type { MyazaTextRecognizer } from '../specs/MyazaTextRecognizer.nitro';
import { extractMrz } from './extract';
import type { MrzScan } from './parse';

// ---------------------------------------------------------------------------
// The native text recogniser, reached from the camera-thread worklet.
//
// Same boxing dance as the face detector: the HybridObject is created on the JS
// thread, boxed, and unboxed inside the worklet, so the frame never crosses the
// bridge — only the recognised lines come back.
//
// A build without the native code (Expo Go, or a host app that has not rebuilt)
// leaves `hasHybridObject` false and every call returns no lines. The MRZ step
// then simply never finds one, which is the same as pointing the camera at a
// blank wall — a capability that is absent rather than an app that crashes.
// ---------------------------------------------------------------------------

/**
 * Resolved LAZILY and re-tried until it appears.
 *
 * Creating it at module load is fragile in a way that fails SILENTLY: if this
 * module evaluates before Nitro's registry is populated — Fast Refresh does
 * this — the reference stays null for the session and every scan returns "no
 * text", which looks exactly like a document the camera cannot read.
 *
 * The BOXED handle is created alongside on the JS thread; a worklet cannot
 * construct one itself, so it must exist before the first frame arrives.
 */
function create(): MyazaTextRecognizer | null {
  try {
    return NitroModules.hasHybridObject('MyazaTextRecognizer')
      ? NitroModules.createHybridObject<MyazaTextRecognizer>('MyazaTextRecognizer')
      : null;
  } catch {
    return null;
  }
}

// EAGER, and it has to be. The worklet below captures `boxed` when the worklet
// is CREATED, so a value that is null at that moment stays null on the camera
// thread forever — every frame then returns no text, which looks exactly like a
// camera that cannot read the document. (A lazy version of this silently killed
// auto-capture.) The JS-side path re-tries via `resolve()` for the cold-start
// case where the registry was not ready at import.
let recognizer: MyazaTextRecognizer | null = create();
// `let`, not `const`: if the eager create above ran before Nitro's registry was
// populated, `resolve()` re-creates AND re-boxes. Leaving this const meant a
// late resolution produced a working JS-side module with a null worklet handle
// — the camera thread stayed blind while everything looked fine from JS.
let boxed: BoxedHybridObject<MyazaTextRecognizer> | null = recognizer ? NitroModules.box(recognizer) : null;

function resolve(): MyazaTextRecognizer | null {
  if (!recognizer) {
    recognizer = create();
    if (recognizer) boxed = NitroModules.box(recognizer);
  }
  return recognizer;
}

/**
 * Whether this build can recognise text at all.
 *
 * Also the WARM-UP: calling it resolves the module on the JS thread so the
 * boxed handle exists by the time frames start arriving in the worklet.
 */
export function hasTextRecognizer(): boolean {
  return resolve() !== null;
}

/**
 * The bottom slice of the frame the MRZ occupies.
 *
 * Generous on purpose: the band tolerates FRAMING, not the document. A tighter
 * crop sliced the MRZ off real captures in the server's own scanner, because
 * the document does not fill the frame — the same mistake is easy to repeat
 * here, and the cost is a scanner that never reads anything.
 */
export const MRZ_BAND_FRACTION = 0.55;

/**
 * Read the MRZ off a captured photo.
 *
 * This is the path the document step uses. Reading it from the picture the user
 * just took is what spares them scanning the same passport a second time for
 * the chip step — the MRZ IS the key that unlocks the chip.
 *
 * Returns null when nothing valid was found, which includes every document that
 * has no MRZ at all. That is the ordinary case, not an error.
 */
export async function scanMrzFromImage(uri: string): Promise<MrzScan | null> {
  const r = resolve();
  if (r == null) return null;
  try {
    const { lines } = await r.recognizeTextInImage(uri, MRZ_BAND_FRACTION);
    const banded = extractMrz(lines);
    if (banded) return banded;
    // Second pass over the WHOLE image. The band is an optimisation, not a
    // truth: Android post-filters by line position rather than true ROI, and a
    // capture whose document sits high (or whose EXIF orientation confused
    // "bottom") can leave the real MRZ just outside the band. One extra pass
    // on an already-captured still is cheap; sending the user to rescan the
    // same passport at the chip step is not.
    const { lines: allLines } = await r.recognizeTextInImage(uri, 1);
    return extractMrz(allLines);
  } catch {
    return null;
  }
}

/**
 * Recognise the MRZ band in a frame. A WORKLET — call it from `onFrame`.
 *
 * Returns an empty array when the recogniser is unavailable or found nothing,
 * which is the ordinary case for most frames while the user is still aiming.
 */
export function recognizeMrzLines(frame: Frame): string[] {
  'worklet';
  if (boxed == null) return [];
  try {
    return boxed.unbox().recognizeText(frame, MRZ_BAND_FRACTION).lines;
  } catch {
    // A recogniser that throws on one frame must not take the scan down; the
    // next frame gets its own attempt.
    return [];
  }
}

/**
 * Recognise text across the WHOLE frame. A WORKLET — call it from `onFrame`.
 *
 * This is what auto-capture reads: identity comes from the printed words
 * ("PASSPORT", "FRSC", "INEC"), which sit above the MRZ band and are cropped
 * out by `recognizeMrzLines`. The MRZ is still recoverable from these lines —
 * it is simply included rather than isolated — so one pass per frame answers
 * both "which document is this" and "is its strip readable".
 */
export function recognizeAllLines(frame: Frame): string[] {
  'worklet';
  if (boxed == null) return [];
  try {
    return boxed.unbox().recognizeText(frame, 1).lines;
  } catch {
    return [];
  }
}
