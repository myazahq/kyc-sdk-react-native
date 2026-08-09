import { useCallback, useRef } from 'react';

import type { FlashResult } from './flashDetector';
import type { LivenessMode } from './types';
import type { LivenessUiState } from './useLiveness';

// ---------------------------------------------------------------------------
// The flash phase's own state.
//
// Split out of useLiveness (200-line rule). Everything here is a REF rather
// than state on purpose: the pending check is read from inside the challenge
// transition, and a stale closure there would either skip the flash entirely or
// run it twice.
// ---------------------------------------------------------------------------

export interface FlashPhase {
  /** Whether the flash sequence still has to run. */
  pending: () => boolean;
  /** Called by the screen once the sequence finishes. */
  complete: (result: FlashResult) => void;
  /** The verdict, once run. */
  result: () => FlashResult | null;
  /** Face discontinuities seen this session. */
  glitches: () => number;
  recordGlitch: () => void;
  /** Clears everything for a retry — including the colour sequence. */
  reset: () => void;
}

export function useFlashPhase(
  mode: LivenessMode | undefined,
  setState: (updater: (s: LivenessUiState) => LivenessUiState) => void,
): FlashPhase {
  const doneRef = useRef(false);
  const resultRef = useRef<FlashResult | null>(null);
  const glitchesRef = useRef(0);

  const pending = useCallback(
    () => (mode === 'flash' || mode === 'both') && !doneRef.current,
    [mode],
  );

  /**
   * The result is carried into the submission as context, NOT used to fail the
   * step: an inconclusive flash (sunlight, or a platform that cannot sample
   * RGB) must not block a user, and the server re-analyses the recorded video
   * regardless. A definite mismatch is what the server acts on.
   */
  const complete = useCallback(
    (result: FlashResult) => {
      doneRef.current = true;
      resultRef.current = result;
      setState((s) =>
        s.phase === 'flash' ? { ...s, phase: 'capturing', instruction: 'Hold still…' } : s,
      );
    },
    [setState],
  );

  const reset = useCallback(() => {
    // A retry runs the whole check again, INCLUDING a fresh colour sequence —
    // reusing the previous one would hand an attacker the answer.
    doneRef.current = false;
    resultRef.current = null;
    glitchesRef.current = 0;
  }, []);

  return {
    pending,
    complete,
    result: () => resultRef.current,
    glitches: () => glitchesRef.current,
    recordGlitch: () => {
      glitchesRef.current += 1;
    },
    reset,
  };
}
