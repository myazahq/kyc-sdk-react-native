import {
  MONTH_NAMES,
  addMonth,
  daysInMonth,
  monthMatrix,
  parseIsoDate,
  toIsoDate,
} from '../lib/calendar';

describe('calendar math', () => {
  it('knows month lengths, including leap Februaries', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2025, 1)).toBe(28);
    expect(daysInMonth(2000, 1)).toBe(29); // divisible-by-400 leap
    expect(daysInMonth(1900, 1)).toBe(28); // divisible-by-100 non-leap
    expect(daysInMonth(2025, 0)).toBe(31);
  });

  it('lays a month out Sunday-first with full seven-cell rows', () => {
    // August 2025 starts on a Friday.
    const weeks = monthMatrix(2025, 7);
    expect(weeks[0]).toEqual([null, null, null, null, null, 1, 2]);
    for (const w of weeks) expect(w).toHaveLength(7);
    expect(weeks.flat().filter((d) => d != null)).toHaveLength(31);
    expect(weeks.at(-1)!.includes(31)).toBe(true);
  });

  it('round-trips ISO dates without a Date object in the middle', () => {
    // The trap this guards: new Date('1985-03-07') is UTC midnight, which is
    // March 6th for every user west of Greenwich.
    expect(toIsoDate({ year: 1985, month0: 2, day: 7 })).toBe('1985-03-07');
    expect(parseIsoDate('1985-03-07')).toEqual({ year: 1985, month0: 2, day: 7 });
  });

  it('rejects what is not a real calendar day', () => {
    for (const bad of ['2025-02-30', '2025-13-01', '2025-00-10', 'tomorrow', '07/03/1985', '']) {
      expect(parseIsoDate(bad)).toBeNull();
    }
    expect(parseIsoDate('2024-02-29')).not.toBeNull(); // real leap day
  });

  it('steps months across year boundaries', () => {
    expect(addMonth(2025, 0, -1)).toEqual({ year: 2024, month0: 11 });
    expect(addMonth(2025, 11, 1)).toEqual({ year: 2026, month0: 0 });
    expect(addMonth(2025, 5, 1)).toEqual({ year: 2025, month0: 6 });
    expect(MONTH_NAMES).toHaveLength(12);
  });
});
