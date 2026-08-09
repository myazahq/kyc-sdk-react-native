import {
  correlateFlash,
  evaluateFlashSequence,
  generateFlashSequence,
  type FlashColor,
  type FlashResult,
  type FlashSample,
  type Rgb,
} from './flashDetector';

// ---------------------------------------------------------------------------
// Driving the flash sequence.
//
// The detector knows the physics; this knows the choreography — paint a colour,
// wait for the screen and camera to catch up, average the face's colour over a
// window, and compare it with the neutral moment immediately before.
//
// The baseline is re-taken BEFORE EACH FLASH rather than once at the start.
// Ambient light drifts (someone walks past a window, an auto-exposure kicks
// in), and a single stale baseline would turn that drift into a fake shift on
// every subsequent flash.
// ---------------------------------------------------------------------------

/** How long each phase of one flash takes. */
export const FLASH_TIMING = {
  /** Neutral settle before measuring the baseline. */
  neutralMs: 150,
  /** Baseline measurement window. */
  baselineMs: 300,
  /**
   * Screen paint → camera exposure latency. Measuring during this window would
   * average lit frames together with unlit ones and dilute the shift.
   */
  litSettleMs: 200,
  /** Lit measurement window. */
  litMs: 450,
} as const;

/** Roughly one sample per camera frame at 15fps. */
const SAMPLE_INTERVAL_MS = 66;

export interface FlashRunnerDeps {
  /** Paints the fullscreen overlay; null clears it back to neutral. */
  setColor: (css: string | null) => void;
  /** The most recent face RGB, or null when the face was not sampled. */
  readFaceRgb: () => Rgb | null;
  /** False once the caller has gone away (unmount, retry, abort). */
  isActive: () => boolean;
  /** Injectable for tests; production uses setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Average the face RGB over a window, or null if nothing could be read. */
async function sampleWindow(
  deps: FlashRunnerDeps,
  durationMs: number,
  sleep: (ms: number) => Promise<void>,
): Promise<Rgb | null> {
  const samples: Rgb[] = [];
  let elapsed = 0;
  while (elapsed < durationMs && deps.isActive()) {
    const rgb = deps.readFaceRgb();
    if (rgb) samples.push(rgb);
    await sleep(SAMPLE_INTERVAL_MS);
    elapsed += SAMPLE_INTERVAL_MS;
  }
  if (samples.length === 0) return null;
  const total = samples.reduce<[number, number, number]>(
    (acc, s) => [acc[0] + s[0], acc[1] + s[1], acc[2] + s[2]],
    [0, 0, 0],
  );
  return [total[0] / samples.length, total[1] / samples.length, total[2] / samples.length];
}

/**
 * Run the whole sequence and return the verdict.
 *
 * The overlay is ALWAYS cleared on the way out, including on an abort — leaving
 * a full-screen colour painted over a stopped flow would strand the user on a
 * red screen with no way back.
 */
export async function runFlashSequence(
  deps: FlashRunnerDeps,
  sequence: FlashColor[] = generateFlashSequence(),
): Promise<FlashResult> {
  const sleep = deps.sleep ?? realSleep;
  const samples: FlashSample[] = [];

  try {
    for (const flash of sequence) {
      if (!deps.isActive()) break;

      deps.setColor(null);
      await sleep(FLASH_TIMING.neutralMs);
      const baseline = await sampleWindow(deps, FLASH_TIMING.baselineMs, sleep);

      deps.setColor(flash.css);
      await sleep(FLASH_TIMING.litSettleMs);
      const lit = await sampleWindow(deps, FLASH_TIMING.litMs, sleep);

      if (!baseline || !lit) {
        // The face left the frame, or the platform cannot sample RGB at all.
        // Unmeasured is not failed — it joins the inconclusive pile, which
        // fails soft.
        samples.push({ inconclusive: true, matched: false, dominance: 0 });
        continue;
      }
      samples.push(correlateFlash(baseline, lit, flash.boost));
    }
  } finally {
    deps.setColor(null);
  }

  return evaluateFlashSequence(sequence, samples);
}
