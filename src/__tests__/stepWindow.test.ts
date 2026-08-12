import { fitStepCircles, windowedSteps } from '../lib/step-window';

/** Readable rendering of a slot row, for assertions that read like the UI. */
const render = (total: number, active: number, max: number): string =>
  windowedSteps(total, active, max)
    .map((s) => (s === 'ellipsis' ? '…' : String(s + 1)))
    .join(' ');

// Real device widths, minus the row's 16dp padding each side.
const SMALL_ANDROID = 360 - 32; // 328
const IPHONE_PRO_MAX = 430 - 32; // 398
const TINY = 320 - 32; // 288

describe('fitStepCircles', () => {
  it('fits more circles on wider screens', () => {
    // (width + margin + minConnector) / (circle + margin + minConnector)
    expect(fitStepCircles(TINY, 26)).toBe(7);
    expect(fitStepCircles(SMALL_ANDROID, 26)).toBe(8);
    expect(fitStepCircles(IPHONE_PRO_MAX, 26)).toBe(9);
  });

  it('reports 0 for an unmeasured width, which means "render them all"', () => {
    expect(fitStepCircles(0, 26)).toBe(0);
    expect(fitStepCircles(NaN, 26)).toBe(0);
    expect(fitStepCircles(-100, 26)).toBe(0);
  });

  it('fits fewer circles once the system text size grows them', () => {
    expect(fitStepCircles(SMALL_ANDROID, 36)).toBeLessThan(fitStepCircles(SMALL_ANDROID, 26));
  });
});

describe('windowedSteps', () => {
  it('shows every step when they fit, however many that is', () => {
    // The whole point: no collapsing while there is room for the real thing.
    expect(render(4, 1, 9)).toBe('1 2 3 4');
    expect(render(8, 3, 9)).toBe('1 2 3 4 5 6 7 8');
  });

  it('renders everything when the width is not known yet', () => {
    // An un-measured first frame must not flash a collapsed row.
    expect(render(12, 5, 0)).toBe('1 2 3 4 5 6 7 8 9 10 11 12');
  });

  it('collapses only once the steps would stop fitting', () => {
    // The same 9-step flow, on two phones: the wider one shows all of it, the
    // narrower one collapses. THIS is the behaviour that was asked for — a
    // fixed cap would have collapsed both.
    expect(render(9, 4, fitStepCircles(IPHONE_PRO_MAX, 26))).toBe('1 2 3 4 5 6 7 8 9');
    expect(render(9, 4, fitStepCircles(SMALL_ANDROID, 26))).toBe('1 … 4 5 6 7 … 9');
    // And a genuinely long one collapses on both, because it fits on neither.
    expect(render(14, 6, fitStepCircles(IPHONE_PRO_MAX, 26))).toContain('…');
    expect(render(14, 6, fitStepCircles(SMALL_ANDROID, 26))).toContain('…');
  });

  it('always shows first and last, so the total is never hidden', () => {
    for (let total = 6; total <= 16; total += 1) {
      for (let active = 0; active < total; active += 1) {
        for (const max of [5, 7, 9, 11]) {
          const slots = windowedSteps(total, active, max);
          expect(slots[0]).toBe(0);
          expect(slots[slots.length - 1]).toBe(total - 1);
        }
      }
    }
  });

  it('always contains the current step', () => {
    for (let total = 6; total <= 16; total += 1) {
      for (let active = 0; active < total; active += 1) {
        for (const max of [5, 7, 9, 11]) {
          expect(windowedSteps(total, active, max)).toContain(active);
        }
      }
    }
  });

  it('never draws more circles than fit', () => {
    for (let total = 1; total <= 20; total += 1) {
      for (let active = 0; active < total; active += 1) {
        for (const max of [5, 7, 9, 11]) {
          const circles = windowedSteps(total, active, max).filter((s) => s !== 'ellipsis').length;
          expect(circles).toBeLessThanOrEqual(Math.max(max, 5));
        }
      }
    }
  });

  it('keeps slots strictly ascending with no duplicates', () => {
    for (let total = 1; total <= 20; total += 1) {
      for (let active = 0; active < total; active += 1) {
        for (const max of [5, 7, 9]) {
          const nums = windowedSteps(total, active, max).filter(
            (s): s is number => s !== 'ellipsis',
          );
          expect([...nums].sort((a, b) => a - b)).toEqual(nums);
          expect(new Set(nums).size).toBe(nums.length);
        }
      }
    }
  });

  it('drops an ellipsis that would hide a single step', () => {
    // Collapsing one step costs the same width as showing it.
    expect(render(12, 0, 7)).toBe('1 2 3 4 … 12');
    expect(render(12, 11, 7)).toBe('1 … 9 10 11 12');
  });

  it('survives nonsense input rather than rendering a broken row', () => {
    expect(windowedSteps(0, 0, 9)).toEqual([]);
    expect(windowedSteps(-3, 2, 9)).toEqual([]);
    expect(render(12, 99, 7)).toBe('1 … 9 10 11 12');
    expect(render(12, -5, 7)).toBe('1 2 3 4 … 12');
  });
});
