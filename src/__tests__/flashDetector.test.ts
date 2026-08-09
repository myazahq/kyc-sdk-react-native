import {
  DOMINANCE_THRESHOLD,
  FLASH_PALETTE,
  MAX_FLASH_SEQUENCE,
  MIN_FLASH_SEQUENCE,
  correlateFlash,
  evaluateFlashSequence,
  generateFlashSequence,
  type FlashSample,
} from '../liveness/flashDetector';

// ─── Flash liveness ───────────────────────────────────────────────────────────
//
// The screen paints a randomised colour sequence; a live face reflects those
// colours in that order. A replay, an injected feed, or a photo held to the
// camera emits its own light and cannot follow a sequence that did not exist
// until the session started.
//
// Two things carry the whole check. The sequence must be UNPREDICTABLE — a
// fixed order is a replayable one. And bright ambient light must fail SOFT: a
// phone in sunlight cannot reflect a screen, and locking people out for
// standing outdoors is a worse error than missing a spoof the gesture checks
// are there to catch.

const sample = (over: Partial<FlashSample> = {}): FlashSample => ({
  inconclusive: false,
  matched: true,
  dominance: 1,
  ...over,
});

describe('the palette', () => {
  it('is the five colours the server also knows', () => {
    // The names are a contract: the server re-analyses the recorded video with
    // this same palette and matches what it sees against the claimed sequence.
    // A name added or renamed on one side reads as a mismatch on the other.
    expect(FLASH_PALETTE.map((c) => c.name)).toEqual([
      'red',
      'green',
      'blue',
      'magenta',
      'cyan',
    ]);
  });

  it('boosts at least one channel per colour', () => {
    for (const colour of FLASH_PALETTE) {
      expect(colour.boost.some((v) => v > 0)).toBe(true);
    }
  });
});

describe('sequence generation', () => {
  it('returns the requested number of DISTINCT colours', () => {
    const seq = generateFlashSequence(4);
    expect(seq).toHaveLength(4);
    expect(new Set(seq.map((c) => c.name)).size).toBe(4);
  });

  it('clamps to what the palette can supply', () => {
    expect(generateFlashSequence(99)).toHaveLength(MAX_FLASH_SEQUENCE);
    expect(generateFlashSequence(0)).toHaveLength(MIN_FLASH_SEQUENCE);
  });

  it('does not produce the same order every time', () => {
    // This is the anti-replay property itself. A generator that returned a
    // fixed order would let an attacker pre-record the reflections.
    const orders = new Set(
      Array.from({ length: 40 }, () =>
        generateFlashSequence(4)
          .map((c) => c.name)
          .join(','),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('is deterministic when given a seeded random, for tests', () => {
    const fixed = () => 0;
    expect(generateFlashSequence(3, fixed).map((c) => c.name)).toEqual(
      generateFlashSequence(3, fixed).map((c) => c.name),
    );
  });
});

describe('correlating one flash', () => {
  const red = [1, 0, 0] as const;

  it('matches a shift along the boosted channel', () => {
    // A red flash on a live face raises red far more than green or blue.
    const result = correlateFlash([100, 100, 100], [140, 104, 103], red);
    expect(result.inconclusive).toBe(false);
    expect(result.matched).toBe(true);
    expect(result.dominance).toBeGreaterThan(DOMINANCE_THRESHOLD);
  });

  it('rejects a shift that went up on every channel equally', () => {
    // What a white light switching on looks like — brighter, but not red.
    const result = correlateFlash([100, 100, 100], [130, 130, 130], red);
    expect(result.inconclusive).toBe(false);
    expect(result.matched).toBe(false);
  });

  it('rejects a shift dominated by the WRONG channel', () => {
    const result = correlateFlash([100, 100, 100], [104, 140, 103], red);
    expect(result.matched).toBe(false);
  });

  it('calls an unmeasurably small shift inconclusive, not failed', () => {
    // Bright ambient light drowns the screen's contribution. That is a missing
    // measurement, not evidence of a spoof.
    const result = correlateFlash([200, 200, 200], [201, 200, 200], red);
    expect(result.inconclusive).toBe(true);
    expect(result.matched).toBe(false);
  });

  it('ignores channels that went DOWN', () => {
    // A flash adds light and never removes it, so a falling channel is noise
    // (or the previous flash decaying) rather than evidence about this one.
    const withDrop = correlateFlash([100, 100, 100], [140, 80, 100], red);
    expect(withDrop.matched).toBe(true);
  });

  it('handles a two-channel boost', () => {
    // Magenta should raise red AND blue while leaving green behind.
    const magenta = FLASH_PALETTE.find((c) => c.name === 'magenta')!;
    const result = correlateFlash([100, 100, 100], [130, 102, 130], magenta.boost);
    expect(result.matched).toBe(true);
  });
});

describe('the whole sequence', () => {
  it('passes when two thirds of the measurable flashes matched', () => {
    const result = evaluateFlashSequence(generateFlashSequence(3), [
      sample(),
      sample(),
      sample({ matched: false }),
    ]);
    expect(result.passed).toBe(true);
    expect(result.matched).toBe(2);
  });

  it('fails when most flashes did not reflect correctly', () => {
    const result = evaluateFlashSequence(generateFlashSequence(3), [
      sample(),
      sample({ matched: false }),
      sample({ matched: false }),
    ]);
    expect(result.passed).toBe(false);
  });

  it('passes SOFT when nothing was measurable at all', () => {
    // Direct sunlight. Failing here would lock out anyone verifying outdoors,
    // which is a worse error than missing a spoof — the gesture checks are the
    // backstop, and the server re-scores the video regardless.
    const result = evaluateFlashSequence(generateFlashSequence(3), [
      sample({ inconclusive: true, matched: false }),
      sample({ inconclusive: true, matched: false }),
      sample({ inconclusive: true, matched: false }),
    ]);
    expect(result.passed).toBe(true);
    expect(result.inconclusive).toBe(3);
  });

  it('judges only the flashes it could actually measure', () => {
    // One good reading and two drowned ones is a pass; counting the drowned
    // ones as failures would make partial sunlight indistinguishable from a
    // spoof.
    const result = evaluateFlashSequence(generateFlashSequence(3), [
      sample(),
      sample({ inconclusive: true, matched: false }),
      sample({ inconclusive: true, matched: false }),
    ]);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('reports the emitted sequence for the server to check the video against', () => {
    const sequence = generateFlashSequence(3);
    const result = evaluateFlashSequence(sequence, [sample(), sample(), sample()]);
    expect(result.sequence).toEqual(sequence.map((c) => c.name));
  });
});
