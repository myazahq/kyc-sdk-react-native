/**
 * Which step circles to draw, and when to start collapsing them.
 *
 * A KYB flow can reach FOURTEEN steps (consent → email → phone →
 * business-details → key-people → documents → applicant-role → country-select →
 * id-type → document-capture → nfc → liveness → questionnaire → submitted), and
 * an individual flow eleven. The circles are a fixed size, so they cannot shrink
 * to fit: on a 360dp Android with 16dp padding, ten steps leave 14dp TOTAL for
 * nine connectors, and twelve steps overflow the row outright.
 *
 * COLLAPSING IS A LAST RESORT. The row fits as many real circles as the measured
 * width allows and only windows once they would stop looking like a connected
 * chain — which is what the minimum connector length below decides. A fixed cap
 * would collapse a 9-step flow on a large phone that had room for all of it.
 *
 * When it does window, two rules keep the elision honest:
 *
 *   • The LAST step is always shown. Without it the ellipsis hides how much is
 *     left, which is the one thing a progress indicator exists to answer.
 *   • The FIRST step is always shown, so the row still reads as a whole journey
 *     rather than a fragment floating in the middle.
 *
 *     1 ··· 5 6 7 ··· 10
 */

/** A rendered slot: a step index, or a collapsed run of them. */
export type StepSlot = number | 'ellipsis';

/**
 * Shortest connector that still reads as a line joining two circles rather than
 * a stray dash. Below this the "chain" metaphor is gone and the row just looks
 * cramped — which is the state the 10-step screenshot was already in.
 */
export const MIN_CONNECTOR = 10;

/** Horizontal margin a connector carries on each side (matches the component). */
const CONNECTOR_MARGIN = 6;

/**
 * Never collapse below this many circles. At 5 the pattern still reads as
 * first · gap · current · gap · last; below it the row says nothing useful.
 */
const MIN_CIRCLES = 5;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/**
 * How many circles fit across `width` before they stop looking like a chain.
 *
 *   n·size + (n−1)·(margins + minConnector) ≤ width
 *
 * Returns 0 when the width is not known yet, which the caller reads as "render
 * them all" — an un-measured first frame should not flash a collapsed row.
 */
export function fitStepCircles(width: number, circleSize: number): number {
  if (!Number.isFinite(width) || width <= 0) return 0;
  const gap = CONNECTOR_MARGIN + MIN_CONNECTOR;
  return Math.max(1, Math.floor((width + gap) / (circleSize + gap)));
}

/**
 * @param total       how many steps the flow has
 * @param active      0-based index of the current step
 * @param maxCircles  how many circles fit (from `fitStepCircles`); 0 = unknown,
 *                    render everything
 */
export function windowedSteps(total: number, active: number, maxCircles = 0): StepSlot[] {
  if (total <= 0) return [];
  const all = Array.from({ length: total }, (_, i) => i);
  if (maxCircles <= 0 || total <= maxCircles) return all;

  // A collapsed row also pays for up to TWO ellipses, each about as wide as a
  // circle once its padding and connectors are counted. Reserving only one
  // between them under-counted, and the row overflowed — which is invisible
  // until you notice every `flex: 1` connector has collapsed to zero width.
  const budget = Math.max(MIN_CIRCLES, maxCircles - 2);
  if (total <= budget) return all;

  const first = 0;
  const last = total - 1;
  const current = clamp(active, first, last);

  // First and last are drawn unconditionally; the rest of the budget is a
  // window centred on the current step.
  const windowSize = Math.max(1, budget - 2);
  const half = Math.floor((windowSize - 1) / 2);
  const start = clamp(current - half, first + 1, Math.max(first + 1, last - windowSize));
  const end = Math.min(start + windowSize - 1, last - 1);

  const slots: StepSlot[] = [first];
  if (start > first + 1) slots.push('ellipsis');
  for (let i = start; i <= end; i += 1) slots.push(i);
  if (end < last - 1) slots.push('ellipsis');
  slots.push(last);
  return slots;
}
