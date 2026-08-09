import { modeRunsGestures, pickChallenges } from '../liveness/challengeManager';

// ---------------------------------------------------------------------------
// Which liveness checks a workflow's `livenessMode` actually runs.
//
// A workflow set to `flash` was still running gesture challenges first and only
// then flashing — the mode was threaded all the way through config, merged, and
// handed to the flash phase, but the thing that CHOOSES challenges never looked
// at it. Nothing failed; the user simply did a mode the org had turned off.
//
// The rule lives in `pickChallenges` rather than at its call sites because
// `useLiveness` rebuilds the tracker in three places (mount, retry, and the
// face-change reset). A check in one of them leaves the other two running
// gestures a flash-only workflow explicitly disabled.
// ---------------------------------------------------------------------------

describe('liveness mode', () => {
  it('runs gestures for every mode except flash-only', () => {
    expect(modeRunsGestures('gestures')).toBe(true);
    expect(modeRunsGestures('both')).toBe(true);
    expect(modeRunsGestures('flash')).toBe(false);
  });

  it('defaults to gestures when a workflow sets no mode', () => {
    // Absent must never mean "skip the check".
    expect(modeRunsGestures(undefined)).toBe(true);
    expect(pickChallenges({}).length).toBeGreaterThan(0);
  });

  it('picks NO gesture challenges in flash-only mode', () => {
    // The regression: this returned a full gesture set, so flash-only ran
    // gestures and then flashed.
    expect(pickChallenges({ mode: 'flash' })).toEqual([]);
  });

  it('still picks gestures for both, which flashes after them', () => {
    expect(pickChallenges({ mode: 'both' }).length).toBeGreaterThan(0);
  });

  it('ignores challengeCount in flash-only mode', () => {
    // Keyed on the mode, not on a count of zero — the count is deliberately
    // clamped to at least one so a stray zero in a consumer's config cannot
    // quietly disable gesture liveness. Skipping gestures has to be asked for.
    expect(pickChallenges({ mode: 'flash', challengeCount: 3 })).toEqual([]);
  });
});
