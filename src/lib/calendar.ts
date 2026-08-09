/**
 * PURE month-grid math for the date picker — no RN imports, so it is unit
 * testable. Dates are handled as plain {year, month0, day} numbers and ISO
 * `YYYY-MM-DD` strings; never Date objects at the edges, because
 * `new Date('YYYY-MM-DD')` parses as UTC midnight and shifts a birthday by a
 * day for every user west of Greenwich.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export interface CalendarDate {
  year: number;
  /** 0-based, matching Date#getMonth. */
  month0: number;
  day: number;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/**
 * The weeks of one month, Sunday-first, padded with nulls so every row is
 * seven cells — the shape a calendar grid renders directly.
 */
export function monthMatrix(year: number, month0: number): (number | null)[][] {
  const firstWeekday = new Date(year, month0, 1).getDay();
  const total = daysInMonth(year, month0);

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function toIsoDate({ year, month0, day }: CalendarDate): string {
  const mm = String(month0 + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** Strictly `YYYY-MM-DD` and a real calendar day — anything else is null. */
export function parseIsoDate(value: string | undefined | null): CalendarDate | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month0 = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month0 < 0 || month0 > 11) return null;
  if (day < 1 || day > daysInMonth(year, month0)) return null;
  return { year, month0, day };
}

/** Step a (year, month0) cursor by ±1 month, carrying across year edges. */
export function addMonth(year: number, month0: number, delta: 1 | -1): { year: number; month0: number } {
  const next = month0 + delta;
  if (next < 0) return { year: year - 1, month0: 11 };
  if (next > 11) return { year: year + 1, month0: 0 };
  return { year, month0: next };
}
