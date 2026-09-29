// ---------------------------------------------------------------------------
// Pure maths for the background (OS geofence) presence tier. A geofence hands
// us ENTER/EXIT moments; the watch wants per-day aggregates — so a dwell SPAN
// is folded into the local calendar days it touched, each with its minutes
// and whether the span overlapped that day's night hours (20:00 to 05:59,
// the same definition the foreground reporter and the server use).
//
// THREE implementations of this fold exist — this file, the Flutter plugin's
// PresenceFold.kt (Android) and PresenceFold.swift (iOS) — because the
// killed-app flush must fold natively. All three are pinned to ONE vector
// file, packages/kyc-sdk-flutter/test/presence_fold_vectors.json, which is
// why the maths is integer arithmetic on an EXPLICIT UTC offset rather than
// platform date APIs: identical inputs must fold identically in every
// language. The offset is captured once per fold (east-positive minutes), a
// fixed-offset approximation that ignores a DST transition inside one span —
// at most an hour of dwell attribution shifts, and cross-platform parity is
// worth more than that edge.
// ---------------------------------------------------------------------------

export interface DayAggregate {
  day: string;
  dwellMinutes: number;
  nightPresent: boolean;
}

/**
 * The longest span one fold will credit. A missed EXIT event (the OS dropped
 * it, the app was killed mid-fence) would otherwise fabricate days of dwell
 * from one stale ENTER timestamp — a fence can fail to close, so the credit
 * from any single span is bounded to one day's worth.
 */
export const MAX_SPAN_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const NIGHT_END_H = 6;
const NIGHT_START_H = 20;

/** The device's UTC offset in east-positive minutes (Lagos = +60). JS's
 *  getTimezoneOffset() is west-positive, hence the sign flip. */
export const deviceUtcOffsetMinutes = (atMs: number): number =>
  -new Date(atMs).getTimezoneOffset();

/** Civil date for a day index (days since 1970-01-01), as YYYY-MM-DD.
 *  Howard Hinnant's civil_from_days — pure integers, no date API, so the
 *  Kotlin and Swift mirrors are line-for-line identical. */
export function civilFromDays(z: number): string {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const year = m <= 2 ? y + 1 : y;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(m)}-${pad(d)}`;
}

/**
 * Fold one dwell span into per-local-day aggregates. `offsetMinutes` is the
 * device's UTC offset (east-positive); it defaults to the device's own so
 * ordinary callers never think about it. An inverted span yields nothing.
 */
export function foldSpanIntoDays(
  enterMs: number,
  exitMs: number,
  offsetMinutes: number = deviceUtcOffsetMinutes(enterMs),
): DayAggregate[] {
  if (!Number.isFinite(enterMs) || !Number.isFinite(exitMs)) return [];
  if (exitMs <= enterMs) return [];
  const offsetMs = offsetMinutes * 60_000;
  const cappedExit = Math.min(exitMs, enterMs + MAX_SPAN_MS);

  const out: DayAggregate[] = [];
  let cursor = enterMs;
  while (cursor < cappedExit) {
    const shifted = cursor + offsetMs;
    const dayIndex = Math.floor(shifted / DAY_MS);
    // The real-clock moment this local day ends.
    const dayEnd = (dayIndex + 1) * DAY_MS - offsetMs;
    const sliceEnd = Math.min(dayEnd, cappedExit);
    // Night = [00:00, 06:00) plus [20:00, 24:00) of this local day. Exact
    // interval overlap — no sampling — so all three languages agree at the
    // boundaries: a slice ENDING exactly at 20:00 has not touched the night.
    const dayStartShifted = dayIndex * DAY_MS;
    const nightPresent =
      shifted < dayStartShifted + NIGHT_END_H * HOUR_MS ||
      sliceEnd + offsetMs > dayStartShifted + NIGHT_START_H * HOUR_MS;
    out.push({
      day: civilFromDays(dayIndex),
      dwellMinutes: Math.max(1, Math.round((sliceEnd - cursor) / 60_000)),
      nightPresent,
    });
    cursor = sliceEnd;
  }
  return out;
}

/**
 * How long an open stay may run before a confirmed "still here" reading
 * records it. A stay used to be credited only when the person LEFT, so
 * someone who hardly leaves home produced no background evidence, and one
 * lost exit capped a multi-day stay at its first 24 hours. Checking in folds
 * the stay so far and restarts it at the confirmation, so the 24-hour cap is
 * measured from the last time we knew they were there. Three hours keeps each
 * folded slice comfortably above the server's 30-minute dwell floor.
 */
export const CHECKPOINT_MS = 3 * 60 * 60 * 1000;

export interface CheckpointResult {
  /** The open stay after the check-in. */
  enterAt: number;
  /** Per-day aggregates to queue (empty when nothing was folded). */
  days: DayAggregate[];
}

/**
 * Apply a CONFIRMED-INSIDE reading at `atMs` to the open-stay state. No open
 * stay opens one (a missed ENTER, or a fence armed while already inside);
 * a stay open at least CHECKPOINT_MS is folded up to `atMs` and restarted
 * there; anything else is unchanged. Only ever called on a reading inside the
 * fence: an outside reading is the exit rules' business, never this one's.
 */
export function checkpointStay(
  enterAt: number | null,
  atMs: number,
  offsetMinutes: number = deviceUtcOffsetMinutes(atMs),
): CheckpointResult {
  if (enterAt == null) return { enterAt: atMs, days: [] };
  if (!Number.isFinite(atMs) || atMs - enterAt < CHECKPOINT_MS) return { enterAt, days: [] };
  return { enterAt: atMs, days: foldSpanIntoDays(enterAt, atMs, offsetMinutes) };
}
