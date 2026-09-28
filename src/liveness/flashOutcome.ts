import type { FlashResult } from './flashDetector';
import type { LivenessMode } from './types';

// ---------------------------------------------------------------------------
// What to do once a flash (screen-reflection) sequence has run.
//
// An UNMEASURABLE flash used to pass soft: bright light drowns the reflection,
// and so does a phone screen held up to the camera, which lights itself. That
// soft pass is exactly what a replay needs. Now:
//
//   - measured and matched          → pass
//   - measured and NOT matched      → fail
//   - unmeasurable, first time      → retry once, after "move away from bright light"
//   - unmeasurable again, 'both'    → the gestures that ran first carried it
//   - unmeasurable again, 'flash'   → fall back to gesture challenges
//
// Port of the web SDK's liveness/flash-outcome.ts; the Flutter SDK carries
// liveness/flash_outcome.dart. Change all three together.
// ---------------------------------------------------------------------------

export type FlashOutcome = 'pass' | 'retry' | 'accept_gestures' | 'fallback_gestures' | 'fail';

export const FLASH_INCONCLUSIVE_RETRIES = 1;

export const FLASH_RETRY_GUIDANCE = 'Move away from bright light and hold still';

/** No flash in the run could be measured (every one drowned, or none ran). */
export function flashUnmeasurable(result: Pick<FlashResult, 'total' | 'inconclusive'>): boolean {
  return result.total - result.inconclusive <= 0;
}

export function flashOutcome(
  result: { passed: boolean; inconclusive: boolean },
  mode: LivenessMode,
  retriesUsed: number,
): FlashOutcome {
  if (result.passed) return 'pass';
  if (!result.inconclusive) return 'fail';
  if (retriesUsed < FLASH_INCONCLUSIVE_RETRIES) return 'retry';
  return mode === 'both' ? 'accept_gestures' : 'fallback_gestures';
}
