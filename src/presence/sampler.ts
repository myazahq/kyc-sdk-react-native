// ---------------------------------------------------------------------------
// Pure state machine for the foreground-service tier. A geofence hands us
// ENTER/EXIT moments; a periodic location sample hands us POSITIONS, and the
// job here is to turn positions back into the same enter/exit spans the
// geofence tier folds, on the SAME stored `enterAt`, so the two tiers
// cooperate on one state rather than double-counting a stay:
//
//   inside,  no open stay  → open one (stamp enterAt)
//   inside,  open stay     → nothing (the fence or an earlier sample did it)
//   outside, open stay     → close it: fold the span into per-day aggregates
//   outside, no open stay  → nothing (absence is never evidence)
//   mocked                 → report the day FLAGGED, never open a stay
//
// Why this exists at all: on phones whose manufacturers kill background work
// (the Tecno/Infinix/Xiaomi population that dominates our markets), geofence
// transitions are dropped, silently. A foreground service keeps the process
// alive and hands it fixes every few minutes; folding those through the same
// span logic is what makes verification finish on those devices.
//
// Mirrors the Flutter plugin's PresenceSampler.kt — keep the two in lockstep.
// ---------------------------------------------------------------------------

import { foldSpanIntoDays } from './background-math';
import { insideFence, localDayAndNight } from './math';
import type { WireObservation } from './post';

export interface SampleFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number;
  mocked: boolean | null;
}

export interface SamplerResult {
  /** The open stay after these samples (null = none open). */
  enterAt: number | null;
  /** Per-day aggregates to queue (same-day entries already merged). */
  observations: WireObservation[];
}

/** Merge day aggregates that landed on the same day (several spans a day):
 *  sum dwell, OR night, sum samples. The geofence flush uses the same rule. */
export function mergeObservations(
  existing: WireObservation[],
  fresh: WireObservation[],
): WireObservation[] {
  const byDay = new Map(existing.map((o) => [o.day, { ...o }]));
  for (const o of fresh) {
    const prior = byDay.get(o.day);
    if (!prior) {
      byDay.set(o.day, { ...o });
      continue;
    }
    prior.dwellMinutes += o.dwellMinutes;
    prior.nightPresent = prior.nightPresent || o.nightPresent;
    prior.samples += o.samples;
    if (o.integrity) prior.integrity = { ...prior.integrity, ...o.integrity };
  }
  return [...byDay.values()];
}

/**
 * Apply a batch of fixes (any order; sorted here) to the open-stay state.
 * `offsetMinutes` is the device's UTC offset for the fold; it defaults to the
 * device's own, and is a parameter only so the maths is testable in any TZ.
 */
export function applyLocationSamples(
  pin: { lat: number; lng: number },
  samples: ReadonlyArray<SampleFix>,
  enterAt: number | null,
  offsetMinutes?: number,
): SamplerResult {
  let open = enterAt;
  let observations: WireObservation[] = [];
  const ordered = [...samples]
    .filter((s) => Number.isFinite(s.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  for (const fix of ordered) {
    if (fix.mocked === true) {
      const { day, nightPresent } = localDayAndNight(new Date(fix.timestamp));
      observations = mergeObservations(observations, [
        {
          day,
          source: 'geofence',
          dwellMinutes: 0,
          nightPresent,
          samples: 1,
          integrity: { mockLocation: true },
        },
      ]);
      continue;
    }
    const inside = insideFence(pin, fix);
    if (inside) {
      if (open == null) open = fix.timestamp;
      continue;
    }
    if (open == null) continue;
    const days = foldSpanIntoDays(open, fix.timestamp, offsetMinutes);
    open = null;
    if (days.length === 0) continue;
    observations = mergeObservations(
      observations,
      days.map((d) => ({ ...d, source: 'geofence' as const, samples: 1 })),
    );
  }
  return { enterAt: open, observations };
}
