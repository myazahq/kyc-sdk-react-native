// ---------------------------------------------------------------------------
// Raising the screen brightness during liveness, and putting it back.
//
// The platform part (which window, which API) is a backend handed in from
// components/brightness-backend.ts; what lives here is the part that has to be
// right whatever the platform: the previous value is read once, before the
// first raise, and written back exactly once; operations run strictly in
// order, so a restore issued while a raise is still in flight lands AFTER it
// (otherwise the late raise would win and the screen would stay at full);
// and nothing ever throws, because a brightness hiccup must never break a
// liveness check.
// ---------------------------------------------------------------------------

export interface BrightnessBackend {
  /**
   * The brightness to put back later, read before the raise. Absent when the
   * backend restores without one (an Android window override is simply
   * cleared). Null means unknown: the restore then does what it can.
   */
  read?: () => Promise<number | null>;
  /** Raise to full. */
  apply: () => Promise<void>;
  /** Put back what `read` returned (null when there was nothing to read). */
  revert: (previous: number | null) => Promise<void>;
}

export interface BrightnessBooster {
  /** Raise to full; a no-op while already raised. */
  boost: () => Promise<void>;
  /** Put the previous brightness back; a no-op unless raised. */
  restore: () => Promise<void>;
  /** Whether the screen is currently raised (for tests and diagnostics). */
  isBoosted: () => boolean;
}

/** A booster that does nothing: no backend on this install. */
const NOOP: BrightnessBooster = {
  boost: async () => {},
  restore: async () => {},
  isBoosted: () => false,
};

export function createBrightnessBooster(backend: BrightnessBackend | null): BrightnessBooster {
  if (!backend) return NOOP;
  let boosted = false;
  let previous: number | null = null;
  let queue: Promise<void> = Promise.resolve();

  const run = (step: () => Promise<void>): Promise<void> => {
    queue = queue.then(step).catch(() => {
      // Swallowed on purpose: see the header. The chain carries on, so a
      // failed raise never blocks the restore behind it.
    });
    return queue;
  };

  return {
    boost: () =>
      run(async () => {
        if (boosted) return;
        previous = backend.read ? await backend.read() : null;
        await backend.apply();
        boosted = true;
      }),
    restore: () =>
      run(async () => {
        if (!boosted) return;
        // Cleared first: a revert that throws must not leave the booster
        // believing it still owes one, or the next raise would be skipped.
        boosted = false;
        const value = previous;
        previous = null;
        await backend.revert(value);
      }),
    isBoosted: () => boosted,
  };
}
