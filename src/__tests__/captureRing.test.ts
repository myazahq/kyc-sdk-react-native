import {
  advanceTarget,
  easeToward,
  livenessProgress,
  mixHex,
  CHALLENGE_SEGMENT_CAP,
} from '../lib/captureRing';

// Mirror of the web SDK's CaptureRing tests. The ring is two numbers: a target
// that only moves forward, and a display that eases toward it.
describe('advanceTarget', () => {
  it('never goes backwards, however far the real number falls', () => {
    for (const real of [0.6, 0.4, 0.2, 0, Number.NaN]) expect(advanceTarget(0.7, real)).toBe(0.7);
  });
  it('follows real progress exactly and clamps an overshoot', () => {
    expect(advanceTarget(0.2, 0.5)).toBe(0.5);
    expect(advanceTarget(0.9, 16 / 15)).toBe(1);
  });
});

describe('easeToward', () => {
  const FRAME = 1 / 60;
  it('never overshoots', () => {
    let shown = 0;
    for (let i = 0; i < 120; i++) {
      const next = easeToward(shown, 0.5, FRAME);
      expect(next).toBeGreaterThanOrEqual(shown);
      expect(next).toBeLessThanOrEqual(0.5);
      shown = next;
    }
  });
  it('is frame-rate independent', () => {
    const whole = easeToward(0, 1, FRAME);
    const halves = easeToward(easeToward(0, 1, FRAME / 2), 1, FRAME / 2);
    expect(halves).toBeCloseTo(whole, 10);
  });
  it('closes fast enough to land with the shutter', () => {
    let shown = 0;
    for (let t = 0; t < 0.3; t += FRAME) shown = easeToward(shown, 1, FRAME);
    expect(shown).toBeGreaterThan(0.95);
  });
});

describe('livenessProgress', () => {
  const base = { completedCount: 0, totalCount: 2, elapsedInPhase: 0, challengeTimeout: 8 } as const;
  const seg = 1 / 4; // positioning + 2 steps + capture

  it('is empty before the test has moved', () => {
    expect(livenessProgress({ ...base, phase: 'loading' })).toBe(0);
    expect(livenessProgress({ ...base, phase: 'positioning' })).toBe(0);
  });

  it('fills a challenge on its clock but never completes it that way', () => {
    const early = livenessProgress({ ...base, phase: 'challenge', elapsedInPhase: 1 });
    const late = livenessProgress({ ...base, phase: 'challenge', elapsedInPhase: 60 });
    expect(early).toBeGreaterThan(seg);
    expect(early).toBeLessThan(late);
    expect(late).toBeCloseTo(seg * (1 + CHALLENGE_SEGMENT_CAP), 10);
  });

  it('a passed gesture lands EXACTLY on the start of the next segment', () => {
    // The hook bumps completedCount at challenge_passed, so the first pass
    // reads completedCount: 1 and must land on the first step's full segment.
    // A `toContain` over both readings used to hedge this; Flutter's twin hid
    // a one-segment overshoot behind the same hedge.
    expect(livenessProgress({ ...base, phase: 'challenge_passed', completedCount: 1 })).toBeCloseTo(seg * 2, 10);
    expect(livenessProgress({ ...base, phase: 'challenge_passed', completedCount: 2 })).toBeCloseTo(seg * 3, 10);
  });

  it('the next challenge does not move the ring backwards', () => {
    const passed = livenessProgress({ ...base, phase: 'challenge_passed', completedCount: 1 });
    const nextStart = livenessProgress({ ...base, phase: 'challenge', completedCount: 1, elapsedInPhase: 0 });
    expect(nextStart).toBeCloseTo(passed, 10);
    expect(livenessProgress({ ...base, phase: 'challenge', completedCount: 1, elapsedInPhase: 1 })).toBeGreaterThan(passed);
  });

  it('the capture segment fills across the still but only complete closes the ring', () => {
    // The still is not in hand until `complete`. A clock that closed the ring
    // showed a finished circle for the seconds the phone was still capturing.
    const start = livenessProgress({ ...base, phase: 'capturing', completedCount: 2 });
    const end = livenessProgress({ ...base, phase: 'capturing', completedCount: 2, elapsedInPhase: 5 });
    expect(start).toBeCloseTo(seg * 3, 10);
    expect(end).toBeCloseTo(seg * (3 + CHALLENGE_SEGMENT_CAP), 10);
    expect(end).toBeLessThan(1);
    expect(livenessProgress({ ...base, phase: 'complete' })).toBe(1);
  });

  it('counts the flash as a step when it runs', () => {
    const withFlash = livenessProgress({ ...base, totalCount: 3, phase: 'flash', completedCount: 2, elapsedInPhase: 0 });
    expect(withFlash).toBeCloseTo((1 / 5) * 3, 10);
  });
});

describe('mixHex', () => {
  it('interpolates and clamps', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#000000', '#ffffff', 7)).toBe('#ffffff');
  });
});
