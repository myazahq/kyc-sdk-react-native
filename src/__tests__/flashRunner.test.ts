import { runFlashSequence, type FlashRunnerDeps } from '../liveness/flashRunner';
import { FLASH_PALETTE, type Rgb } from '../liveness/flashDetector';

// ─── Driving the flash sequence ───────────────────────────────────────────────
//
// The choreography around the physics: paint, wait for the screen and camera to
// catch up, measure, compare against the neutral moment immediately before.
//
// Two behaviours are safety-critical rather than cosmetic. The overlay must
// ALWAYS be cleared — a full-screen colour left painted over an aborted flow
// strands the user on a red screen. And a re-taken baseline per flash is what
// stops ambient drift (a window, an auto-exposure adjustment) from reading as a
// colour shift on every later flash.

const RED = FLASH_PALETTE.find((c) => c.name === 'red')!;
const GREEN = FLASH_PALETTE.find((c) => c.name === 'green')!;

/**
 * A fake camera that reports whatever colour the screen is currently painting,
 * reflected off a face — i.e. a live subject behaving correctly.
 */
function liveFace(over: Partial<FlashRunnerDeps> = {}) {
  let painted: string | null = null;
  const colors: Array<string | null> = [];
  const deps: FlashRunnerDeps = {
    setColor: (css) => {
      painted = css;
      colors.push(css);
    },
    readFaceRgb: (): Rgb => {
      if (painted === null) return [100, 100, 100];
      const flash = FLASH_PALETTE.find((c) => c.css === painted)!;
      return [
        100 + flash.boost[0] * 40,
        100 + flash.boost[1] * 40,
        100 + flash.boost[2] * 40,
      ];
    },
    isActive: () => true,
    // Time is simulated: the real timings would make this suite take minutes.
    sleep: async () => {},
    ...over,
  };
  return { deps, colors, painted: () => painted };
}

describe('a live face', () => {
  it('passes when it reflects each colour', async () => {
    const { deps } = liveFace();
    const result = await runFlashSequence(deps, [RED, GREEN]);
    expect(result.passed).toBe(true);
    expect(result.matched).toBe(2);
    expect(result.sequence).toEqual(['red', 'green']);
  });

  it('measures against a fresh baseline each time', async () => {
    // The overlay is cleared before every flash, not just at the start — that
    // neutral moment IS the baseline, and re-taking it is what makes ambient
    // drift cancel out instead of accumulating.
    const { deps, colors } = liveFace();
    await runFlashSequence(deps, [RED, GREEN]);
    expect(colors.filter((c) => c === null).length).toBeGreaterThanOrEqual(2);
  });
});

describe('a spoof', () => {
  it('fails a glossy screen that brightens without taking the colour', async () => {
    // A phone or monitor held up to the camera reflects our flash off its
    // glass: measurably brighter, but neutrally so, because the emitted image
    // underneath does not change. That neutral shift is what gives it away.
    let painted: string | null = null;
    const result = await runFlashSequence(
      {
        setColor: (css) => {
          painted = css;
        },
        readFaceRgb: () => (painted === null ? [100, 100, 100] : [140, 140, 140]),
        isActive: () => true,
        sleep: async () => {},
      },
      [RED, GREEN],
    );
    expect(result.passed).toBe(false);
    expect(result.matched).toBe(0);
  });

  it('fails when the shift lands on the wrong channel', async () => {
    let painted: string | null = null;
    const result = await runFlashSequence(
      {
        setColor: (css) => {
          painted = css;
        },
        readFaceRgb: () => (painted === null ? [100, 100, 100] : [100, 140, 100]),
        isActive: () => true,
        sleep: async () => {},
      },
      [RED, RED],
    );
    expect(result.passed).toBe(false);
  });

  it('does NOT catch a replay that reflects nothing at all', async () => {
    // Pinned deliberately, because it is the honest limit of this check: a
    // video replayed in a dark room produces no measurable shift, which is
    // indistinguishable from sunlight — and both soft-pass. Flash defeats
    // replays by making the SEQUENCE unpredictable, which the server verifies
    // against the recorded video; the gesture challenges and that server-side
    // re-analysis are what cover this case, not this correlation.
    const { deps } = liveFace({ readFaceRgb: () => [100, 100, 100] });
    const result = await runFlashSequence(deps, [RED, GREEN]);
    expect(result.inconclusive).toBe(2);
    expect(result.passed).toBe(true);
  });
});

describe('conditions it cannot measure', () => {
  it('passes soft in light too bright to read a reflection', async () => {
    // Direct sunlight swamps the screen's contribution. Failing here would lock
    // out anyone verifying outdoors, which is worse than missing a spoof the
    // gesture checks and the server's own re-analysis still cover.
    const { deps } = liveFace({ readFaceRgb: () => [250, 250, 250] });
    const result = await runFlashSequence(deps, [RED, GREEN]);
    expect(result.passed).toBe(true);
    expect(result.inconclusive).toBe(2);
  });

  it('treats a face that left the frame as unmeasured, not failed', async () => {
    const { deps } = liveFace({ readFaceRgb: () => null });
    const result = await runFlashSequence(deps, [RED, GREEN]);
    expect(result.inconclusive).toBe(2);
    expect(result.passed).toBe(true);
  });

  it('survives a platform that cannot sample RGB at all', async () => {
    // Older builds without the native RGB sampling. The step must still
    // complete rather than hang or throw.
    const { deps } = liveFace({ readFaceRgb: () => null });
    await expect(runFlashSequence(deps, [RED])).resolves.toBeDefined();
  });
});

describe('aborting', () => {
  it('always clears the overlay', async () => {
    // A full-screen colour left painted over a stopped flow is a dead end the
    // user cannot navigate away from.
    const { deps, painted } = liveFace({ isActive: () => false });
    await runFlashSequence(deps, [RED, GREEN]);
    expect(painted()).toBeNull();
  });

  it('clears the overlay even when sampling throws', async () => {
    const { deps, painted } = liveFace({
      readFaceRgb: () => {
        throw new Error('camera died');
      },
    });
    await expect(runFlashSequence(deps, [RED])).rejects.toThrow();
    expect(painted()).toBeNull();
  });

  it('stops early rather than running every flash after an abort', async () => {
    let calls = 0;
    const { deps } = liveFace({
      isActive: () => {
        calls++;
        return calls < 2;
      },
    });
    const result = await runFlashSequence(deps, [RED, GREEN, RED, GREEN]);
    expect(result.total).toBeLessThan(4);
  });
});
