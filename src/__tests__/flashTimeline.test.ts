import { flashOnsets } from '../liveness/flashTimeline';
import { holdCameraSteady, type SteadyController } from '../liveness/cameraSteady';
import { runFlashSequence } from '../liveness/flashRunner';
import type { FlashColor } from '../liveness/flashDetector';

describe('flash colour times', () => {
  it('are measured from the start of the recording', () => {
    expect(flashOnsets([5450, 6550, 7650], 3, 1000)).toEqual([4450, 5550, 6650]);
  });

  it('are left out when nothing was recording, a colour never ran, or they do not rise', () => {
    expect(flashOnsets([5450, 6550], 2, null)).toBeUndefined();
    expect(flashOnsets([5450, 6550], 3, 1000)).toBeUndefined();
    expect(flashOnsets([900, 2000], 2, 1000)).toBeUndefined();
    expect(flashOnsets([5450, 5450], 2, 1000)).toBeUndefined();
  });

  it('ride on the flash result, one per colour, in order', async () => {
    const sequence: FlashColor[] = [
      { css: '#ff2020', boost: [1, 0, 0], name: 'red' },
      { css: '#20ff40', boost: [0, 1, 0], name: 'green' },
    ];
    let clock = 10_000;
    let colour: string | null = null;
    const result = await runFlashSequence(
      {
        setColor: (css) => {
          colour = css;
        },
        readFaceRgb: () => (colour === '#ff2020' ? [140, 100, 100] : colour ? [100, 140, 100] : [100, 100, 100]),
        isActive: () => true,
        sleep: async (ms) => {
          clock += ms;
        },
        now: () => clock,
        recordingStartedAt: () => 9_000,
      },
      sequence,
    );
    expect(result.sequence).toEqual(['red', 'green']);
    expect(result.onsets).toHaveLength(2);
    expect(result.onsets![0]).toBeGreaterThan(1000);
    expect(result.onsets![1]! - result.onsets![0]!).toBeGreaterThanOrEqual(1000);
  });
});

describe('holding the camera steady', () => {
  const controller = (over: Partial<SteadyController> = {}, supports = { e: true, w: true }) => {
    const calls: string[] = [];
    const c: SteadyController = {
      device: { supportsExposureLocking: supports.e, supportsWhiteBalanceLocking: supports.w },
      lockCurrentExposure: async () => void calls.push('exposure'),
      lockCurrentWhiteBalance: async () => void calls.push('white-balance'),
      resetFocus: async () => void calls.push('reset'),
      ...over,
    };
    return { c, calls };
  };

  it('locks exposure and white balance, and hands them back', async () => {
    const { c, calls } = controller();
    const release = await holdCameraSteady(c);
    expect(calls).toEqual(['exposure', 'white-balance']);
    release();
    expect(calls).toContain('reset');
  });

  it('locks only what the camera supports', async () => {
    const { c, calls } = controller({}, { e: true, w: false });
    await holdCameraSteady(c);
    expect(calls).toEqual(['exposure']);
  });

  it('does nothing, and resets nothing, on a camera that cannot lock or refuses', async () => {
    const none = controller({}, { e: false, w: false });
    (await holdCameraSteady(none.c))();
    expect(none.calls).toEqual([]);

    const refuses = controller({
      lockCurrentExposure: async () => Promise.reject(new Error('no')),
      lockCurrentWhiteBalance: async () => Promise.reject(new Error('no')),
    });
    (await holdCameraSteady(refuses.c))();
    expect(refuses.calls).toEqual([]);
  });

  it('does nothing without a camera', async () => {
    expect(() => holdCameraSteady(null).then((release) => release())).not.toThrow();
  });
});
