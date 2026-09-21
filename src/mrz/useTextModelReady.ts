import { useNativeModelReady, type ModelReadyState } from '../lib/model-ready';
import { isTextModelReady, primeTextModel } from './textRecognizer';

// The text half of the shared readiness gate. The rule, the polling and the
// reasoning live in ../lib/model-ready.ts — the same gate the face detector
// uses, for the same reason.

export type { ModelReadyState };

/**
 * Tracks whether on-device text recognition can run.
 *
 * The live MRZ scanner is what gates on this: the printed strip IS the chip's
 * access key, so a recogniser that can never run leaves the user aiming at a
 * passport that is silently never read. Auto-capture deliberately does NOT gate
 * on it — there the recogniser is an accelerator and the manual shutter is
 * always live, so an absent model costs convenience rather than a dead end.
 */
export function useTextModelReady(): ModelReadyState {
  return useNativeModelReady(isTextModelReady, primeTextModel);
}
