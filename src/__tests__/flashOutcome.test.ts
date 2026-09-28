import { flashOutcome, flashUnmeasurable } from '../liveness/flashOutcome';
import { evaluateFlashSequence } from '../liveness/flashDetector';
import { ChallengeTracker, pickChallenges, pickFallbackGestures } from '../liveness/challengeManager';

const matched = { passed: true, inconclusive: false };
const mismatched = { passed: false, inconclusive: false };
const unmeasurable = { passed: false, inconclusive: true };

describe('flashOutcome (port of the web rule)', () => {
  it('passes a measured match and fails a measured mismatch', () => {
    expect(flashOutcome(matched, 'flash', 0)).toBe('pass');
    expect(flashOutcome(mismatched, 'both', 0)).toBe('fail');
  });

  it('retries an unmeasurable flash once, then lets gestures carry it', () => {
    expect(flashOutcome(unmeasurable, 'flash', 0)).toBe('retry');
    expect(flashOutcome(unmeasurable, 'both', 1)).toBe('accept_gestures');
    expect(flashOutcome(unmeasurable, 'flash', 1)).toBe('fallback_gestures');
  });
});

describe('an unmeasurable flash is not a pass', () => {
  it('fails a run with no measurable sample', () => {
    const r = evaluateFlashSequence([], [{ inconclusive: true, matched: false, dominance: 0 }]);
    expect(r.passed).toBe(false);
    expect(flashUnmeasurable(r)).toBe(true);
  });

  it('treats a sequence that never ran as unmeasurable', () => {
    expect(flashUnmeasurable({ total: 0, inconclusive: 0 })).toBe(true);
    expect(flashUnmeasurable({ total: 4, inconclusive: 3 })).toBe(false);
  });
});

describe('gesture fallback', () => {
  it('appends gestures to an empty flash-only tracker and makes the first active', () => {
    const tracker = new ChallengeTracker(pickChallenges({ mode: 'flash' }));
    expect(tracker.current).toBeNull();
    tracker.append(pickFallbackGestures({ mode: 'flash' }));
    expect(tracker.current?.progress).toBe('active');
    expect(tracker.totalCount).toBeGreaterThan(0);
  });
});
