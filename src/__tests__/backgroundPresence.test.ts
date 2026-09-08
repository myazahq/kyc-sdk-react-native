import { MAX_SPAN_MS, foldSpanIntoDays } from '../presence/background-math';

// Local-time construction so the fold's device-clock semantics are what the
// test exercises, whatever TZ CI runs in.
const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi).getTime();

describe('foldSpanIntoDays', () => {
  it('credits a daytime stay to its one day, no night flag', () => {
    const days = foldSpanIntoDays(at(2026, 8, 31, 9), at(2026, 8, 31, 11, 30));
    expect(days).toEqual([{ day: '2026-08-31', dwellMinutes: 150, nightPresent: false }]);
  });

  it('splits a span that crosses midnight across both days, each flagged night', () => {
    const days = foldSpanIntoDays(at(2026, 8, 31, 22), at(2026, 9, 1, 7));
    expect(days.map((d) => d.day)).toEqual(['2026-08-31', '2026-09-01']);
    expect(days[0]).toMatchObject({ dwellMinutes: 120, nightPresent: true });
    expect(days[1]).toMatchObject({ dwellMinutes: 420, nightPresent: true });
  });

  it('flags night for an evening arrival that only touches 20:00', () => {
    const days = foldSpanIntoDays(at(2026, 8, 31, 19, 30), at(2026, 8, 31, 20, 30));
    expect(days[0]!.nightPresent).toBe(true);
  });

  it('caps a span at one day — a missed exit must not fabricate a week', () => {
    const enter = at(2026, 8, 25, 10);
    const days = foldSpanIntoDays(enter, enter + 7 * 24 * 60 * 60 * 1000);
    const total = days.reduce((sum, d) => sum + d.dwellMinutes, 0);
    expect(total).toBeLessThanOrEqual(MAX_SPAN_MS / 60_000 + days.length);
  });

  it('yields nothing for an inverted or empty span', () => {
    expect(foldSpanIntoDays(at(2026, 8, 31, 9), at(2026, 8, 31, 9))).toEqual([]);
    expect(foldSpanIntoDays(at(2026, 8, 31, 9), at(2026, 8, 31, 8))).toEqual([]);
    expect(foldSpanIntoDays(Number.NaN, at(2026, 8, 31, 9))).toEqual([]);
  });
});
