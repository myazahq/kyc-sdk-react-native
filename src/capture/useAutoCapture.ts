import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrameOutput } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-worklets';

import { hasTextRecognizer, recognizeAllLines } from '../mrz/textRecognizer';
import { extractMrz } from '../mrz/extract';
import type { MrzScan } from '../mrz/parse';
import { DocumentTextGate } from './documentTextGate';
import { documentCarriesMrz, type DocumentGuidance } from './documentIdentity';
import { detectRectOnFrame, hasRectDetector } from './rectDetector';
import { rectFramingProblem } from './rectGate';
import type { DetectedRect } from '../specs/MyazaRectDetector.nitro';

// ---------------------------------------------------------------------------
// Auto-capture: shoot when the document is identified, framed and still.
//
// Detection is an ACCELERATOR, never the only route — the manual shutter stays
// live throughout, and a build without the native recogniser simply never fires
// this, leaving the manual flow exactly as it was.
//
// Reading text per frame also banks the MRZ ahead of the shutter, so the chip
// step needs no second scan of the same passport. That is the main reason the
// gate reads text rather than just measuring edges.
// ---------------------------------------------------------------------------

/** How often a frame is actually recognised. OCR is far slower than 30fps. */
const DETECT_INTERVAL_MS = 250;

export interface AutoCaptureOptions {
  /** Off while capturing/uploading, on a preview, or when there is no camera. */
  enabled: boolean;
  country: string;
  idType: string;
  /**
   * Which face is up. The back of a card carries none of the front's identity
   * keywords (a PVC back is barcode and small print), so the gate must not
   * demand them there — the front capture moments earlier established what
   * document this is.
   */
  side?: 'front' | 'back';
  /** The chip step wants the MRZ, so hold out for a check-digit-valid read. */
  requireMrz?: boolean;
  /** An MRZ is already stored from an earlier frame or a previous side. */
  mrzAlreadyCaptured?: boolean;
  /** Called once per fresh MRZ read — bank it for the chip step. */
  onMrz?: (scan: MrzScan) => void;
  /** Called once when the gate decides to shoot. */
  onFire: () => void;
  /** Expected width ÷ height, for the geometry check where it is available. */
  guideAspect?: number;
  /**
   * Changing this starts a fresh dwell.
   *
   * Load-bearing for two-sided documents: the front and the back are the same
   * `idType`, and the viewfinder does not remount between them — so without a
   * key that actually changes, the gate stays LATCHED from the front and the
   * back never auto-captures. Pass the side (or anything else that identifies
   * "this is a new thing to look at").
   */
  resetKey?: string;
}

export interface AutoCaptureState {
  /** Attach to `<Camera outputs={[...]}>`. */
  frameOutput: ReturnType<typeof useFrameOutput>;
  guidance: DocumentGuidance;
  /** 0..1 through the stability dwell — drives the scan ring. */
  progress: number;
  /** Whether a check-digit-valid MRZ has been read this session. */
  hasMrz: boolean;
  /** Start a fresh dwell (new side, or a retake). */
  reset: () => void;
}

const INITIAL: DocumentGuidance = { framing: 'none', hint: 'searching' };

export function useAutoCapture({
  enabled,
  country,
  idType,
  side = 'front',
  requireMrz = false,
  mrzAlreadyCaptured = false,
  onMrz,
  onFire,
  guideAspect = 1.586,
  resetKey,
}: AutoCaptureOptions): AutoCaptureState {
  // RESOLVE FIRST, synchronously, before `useFrameOutput` below builds the
  // worklet. Both modules hand the worklet a BOXED handle that only the JS
  // thread can create, and the worklet captures that handle when it is CREATED
  // — so a handle still unresolved at that moment is null on the camera thread
  // forever, and every frame reports "no text, no rectangle".
  //
  // Module-import time is too early (Nitro's registry may not be populated) and
  // a useEffect is too late (it runs after the worklet exists). The component
  // body is the one place that is both.
  hasTextRecognizer();
  hasRectDetector();

  const gate = useMemo(() => new DocumentTextGate(), []);
  const [guidance, setGuidance] = useState<DocumentGuidance>(INITIAL);
  const [progress, setProgress] = useState(0);
  const [hasMrz, setHasMrz] = useState(false);

  const lastDetectRef = useRef(0);
  const firedRef = useRef(false);
  // Refs, not deps: the worklet callback is created once, and re-creating it on
  // every guidance change would tear down the frame output mid-stream.
  const optsRef = useRef({ enabled, country, idType, side, requireMrz, mrzAlreadyCaptured, onMrz, onFire, guideAspect });
  optsRef.current = { enabled, country, idType, side, requireMrz, mrzAlreadyCaptured, onMrz, onFire, guideAspect };

  // Deliberately does NOT clear `hasMrz`: the MRZ belongs to the document, not
  // to the side being photographed, and clearing it would make the chip step
  // ask for a strip that has already been read.
  const reset = useCallback(() => {
    gate.reset();
    firedRef.current = false;
    lastDetectRef.current = 0;
    setGuidance(INITIAL);
    setProgress(0);
  }, [gate]);

  // A new side is a new document face: the previous side's dwell and verdict
  // must not carry over, or the back would fire on the front's decision — and
  // worse, the gate's `fired` latch would mean it never fires at all.
  // `idType` alone is NOT enough: both sides of a card share it.
  useEffect(() => {
    reset();
  }, [idType, resetKey, reset]);

  const handleFrame = useCallback((lines: string[], rect: DetectedRect) => {
    const o = optsRef.current;
    if (!o.enabled || firedRef.current) return;

    const now = Date.now();
    if (now - lastDetectRef.current < DETECT_INTERVAL_MS) return;
    lastDetectRef.current = now;

    // Bank the MRZ whenever one validates — this is what spares the user
    // scanning the same passport again at the chip step.
    let freshMrz = false;
    const scan = extractMrz(lines);
    if (scan) {
      freshMrz = true;
      setHasMrz(true);
      o.onMrz?.(scan);
    }

    // GEOMETRY first, where the platform has it. A shape complaint is
    // actionable on its own ("move back"), and letting it through would mean
    // running out a stability dwell on a document whose corners are cut off.
    // Absent a detector this is null and the text gate decides alone.
    const shapeProblem = rectFramingProblem(rect, { expectedAspect: o.guideAspect });
    if (shapeProblem) {
      setGuidance({ framing: 'adjust', hint: shapeProblem });
      setProgress(0);
      return;
    }

    const verdict = gate.update(lines, {
      country: o.country,
      idType: o.idType,
      side: o.side,
      // The MRZ is a FRONT-side key; the back of a card has no strip to wait for.
      requireMrz: o.side !== 'back' && (o.requireMrz || documentCarriesMrz(o.idType)),
      hasValidMrz: freshMrz,
      mrzAlreadyCaptured: o.mrzAlreadyCaptured,
      now,
    });
    setGuidance(verdict);
    setProgress(gate.progress(now));

    if (verdict.framing === 'ready' && !firedRef.current) {
      firedRef.current = true;
      o.onFire();
    }
  }, [gate]);

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    // Recognition runs far longer than a frame interval, so skip whatever
    // arrives mid-pass rather than queueing it late.
    dropFramesWhileBusy: true,
    onFrame: (frame) => {
      'worklet';
      const lines = recognizeAllLines(frame);
      const rect = detectRectOnFrame(frame);
      frame.dispose();
      runOnJS(handleFrame)(lines, rect);
    },
    onFrameDropped: () => {
      'worklet';
    },
  });

  return { frameOutput, guidance, progress, hasMrz, reset };
}
