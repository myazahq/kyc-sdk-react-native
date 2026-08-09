import { useEffect, useRef, useState } from 'react';

import { runFlashSequence } from '../liveness/flashRunner';
import { DEFAULT_FLASH_SEQUENCE, generateFlashSequence } from '../liveness/flashDetector';
import type { FlashResult, Rgb } from '../liveness/flashDetector';

// ---------------------------------------------------------------------------
// Running the flash sequence from the liveness screen.
//
// Split out of LivenessStep (200-line rule). It starts once when the machine
// asks, and tears down on unmount so a half-finished sequence can never leave
// the screen painted a solid colour with no way back.
// ---------------------------------------------------------------------------

/** A sequence that could not run at all — unmeasured, which fails soft. */
const UNMEASURED: FlashResult = {
  passed: true,
  score: 0,
  matched: 0,
  total: 0,
  inconclusive: 0,
  sequence: [],
};

export function useFlashSequence({
  active,
  shouldContinue,
  sequenceLength,
  readFaceRgb,
  onComplete,
}: {
  /** True while the machine is in the flash phase. */
  active: boolean;
  /**
   * Aborts mid-sequence when it returns false — a second face, or a swapped
   * one. Finishing would measure a reflection off somebody who is not the
   * subject, which is worse than no measurement at all.
   */
  shouldContinue?: () => boolean;
  sequenceLength: number | undefined;
  readFaceRgb: () => Rgb | null;
  onComplete: (result: FlashResult) => void;
}): { flashColor: string | null } {
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const startedRef = useRef(false);
  const liveRef = useRef(true);
  // The callbacks are read through refs so the effect below never re-runs on
  // their identity — restarting a sequence mid-flight would leave the screen
  // painted and the counter of measured flashes wrong.
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const readRef = useRef(readFaceRgb);
  readRef.current = readFaceRgb;
  const continueRef = useRef(shouldContinue);
  continueRef.current = shouldContinue;

  useEffect(
    () => () => {
      liveRef.current = false;
    },
    [],
  );

  useEffect(() => {
    // Re-arm when the phase leaves flash. The guard exists to stop the sequence
    // restarting while it is ALREADY running (the effect re-runs whenever the
    // screen re-renders), but it was never cleared — so a retake found it still
    // set from the first attempt, returned immediately, and left the machine
    // parked in the flash phase with nothing driving it. The step hung with no
    // error, because from its point of view a sequence was still in flight.
    if (!active) {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    void runFlashSequence(
      {
        setColor: setFlashColor,
        readFaceRgb: () => readRef.current(),
        isActive: () => liveRef.current && (continueRef.current?.() ?? true),
      },
      generateFlashSequence(sequenceLength ?? DEFAULT_FLASH_SEQUENCE),
    )
      .then((result) => completeRef.current(result))
      .catch(() => {
        // A failed sequence is a MISSING measurement, not a failed check — the
        // user is not at fault for a camera hiccup, and the server re-analyses
        // the recorded video regardless.
        setFlashColor(null);
        completeRef.current(UNMEASURED);
      });
  }, [active, sequenceLength]);

  return { flashColor };
}
