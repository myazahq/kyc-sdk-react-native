// ---------------------------------------------------------------------------
// Flash (screen-reflection) liveness — the pure correlation core.
//
// The screen emits a short RANDOMIZED colour sequence while the camera records;
// a live face physically reflects those colours in that order. A replayed
// video, an injected feed, or a screen held up to the camera emits its own
// light and cannot match a sequence that did not exist until this session
// started. That is the whole anti-replay property, and it is why the sequence
// must be generated fresh per session and never reused.
//
// No camera or native dependency here: the caller feeds face-region RGB
// samples. That is what makes the physics testable with synthetic numbers.
//
// The palette names and the dominance formula are a CONTRACT WITH THE SERVER.
// `src/docbio/analysis.ts` re-analyses the recorded video with the same palette
// and the same test, then LCS-matches what it detects against the sequence the
// client claims. If the two sides measured different things, an honest client
// would look like a mismatch — so this mirrors the server exactly, including
// using the positive-shift SHARE rather than a vector projection.
// ---------------------------------------------------------------------------

export interface FlashColor {
  /** Stable name — this is what the claim and the server's analysis compare. */
  name: string;
  /** Colour painted over the screen. */
  css: string;
  /** Which RGB channels a live reflection should shift along. */
  boost: [number, number, number];
}

/** High-luminance primaries — maximum reflected signal per channel. */
export const FLASH_PALETTE: readonly FlashColor[] = [
  { name: 'red', css: '#ff2020', boost: [1, 0, 0] },
  { name: 'green', css: '#20ff40', boost: [0, 1, 0] },
  { name: 'blue', css: '#2050ff', boost: [0, 0, 1] },
  { name: 'magenta', css: '#ff20d0', boost: [1, 0, 1] },
  { name: 'cyan', css: '#20ffe0', boost: [0, 1, 1] },
];

/**
 * Minimum shift magnitude (0–255 scale) for a flash to be measurable. Below it
 * the ambient light drowned the reflection — inconclusive, not failed.
 */
export const MIN_SHIFT_MAGNITUDE = 3;

/** The share of the positive shift that must lie on the boosted channels. */
export const DOMINANCE_THRESHOLD = 0.55;

/** Colours in a sequence. More is harder to spoof but longer to sit through. */
export const MIN_FLASH_SEQUENCE = 2;
export const MAX_FLASH_SEQUENCE = 5;
export const DEFAULT_FLASH_SEQUENCE = 4;

export type Rgb = readonly [number, number, number];

/**
 * A fresh random sequence.
 *
 * `random` is injectable so tests can pin the order; production must use real
 * randomness — a predictable sequence is a replayable one, which defeats the
 * entire check.
 */
export function generateFlashSequence(
  count = DEFAULT_FLASH_SEQUENCE,
  random: () => number = Math.random,
): FlashColor[] {
  const pool = [...FLASH_PALETTE];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const n = Math.min(MAX_FLASH_SEQUENCE, Math.max(MIN_FLASH_SEQUENCE, Math.round(count)));
  return pool.slice(0, n);
}

export interface FlashSample {
  /** The ambient light drowned the flash — no verdict either way. */
  inconclusive: boolean;
  matched: boolean;
  /** Boosted-channel share of the positive shift (0–1); 0 when inconclusive. */
  dominance: number;
}

/**
 * Correlate one flash: did the face's colour shift the way this flash should
 * have made it shift?
 *
 * `baseline` and `lit` are mean face-region RGB (0–255) from immediately before
 * and during the flash. Taking the baseline per-flash rather than once tracks
 * ambient drift — someone walking under a light mid-sequence would otherwise
 * look like a failure.
 */
export function correlateFlash(baseline: Rgb, lit: Rgb, boost: Rgb): FlashSample {
  const shift = [lit[0] - baseline[0], lit[1] - baseline[1], lit[2] - baseline[2]];
  const magnitude = Math.abs(shift[0]!) + Math.abs(shift[1]!) + Math.abs(shift[2]!);
  if (magnitude < MIN_SHIFT_MAGNITUDE) {
    return { inconclusive: true, matched: false, dominance: 0 };
  }

  // Only the POSITIVE shift counts: a flash adds light, it never removes it, so
  // a channel that dropped is noise (or the previous flash decaying) rather
  // than evidence about this one.
  const totalPositive = shift.reduce((acc, v) => acc + Math.max(0, v!), 0);
  const boosted = shift.reduce((acc, v, i) => acc + Math.max(0, v!) * boost[i]!, 0);
  const dominance = totalPositive > 0 ? boosted / totalPositive : 0;

  return { inconclusive: false, matched: dominance >= DOMINANCE_THRESHOLD, dominance };
}

export interface FlashResult {
  passed: boolean;
  /** Matched / measurable (0–1). */
  score: number;
  matched: number;
  total: number;
  inconclusive: number;
  /** The colours emitted, in order — the claim the server checks the video against. */
  sequence: string[];
}

/**
 * Aggregate the per-flash samples.
 *
 * Two thirds of the MEASURABLE flashes must match. Flashes the ambient light
 * drowned are excluded rather than counted against the user: a phone in direct
 * sunlight cannot reflect a screen, and failing people for standing outdoors
 * would be a worse error than missing a spoof — which is why an all-inconclusive
 * run passes soft. Paper-photo and mask attacks are the gesture checks' job.
 */
export function evaluateFlashSequence(
  sequence: readonly FlashColor[],
  samples: readonly FlashSample[],
): FlashResult {
  const measurable = samples.filter((s) => !s.inconclusive);
  const matched = measurable.filter((s) => s.matched).length;
  const inconclusive = samples.length - measurable.length;
  return {
    passed: measurable.length === 0 || matched >= Math.ceil(measurable.length * 0.66),
    score: measurable.length === 0 ? 0 : matched / measurable.length,
    matched,
    total: samples.length,
    inconclusive,
    sequence: sequence.map((c) => c.name),
  };
}
