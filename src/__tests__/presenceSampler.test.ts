import { applyLocationSamples, mergeObservations } from '../presence/sampler';

// The foreground-service tier's state machine: positions in, the geofence
// tier's enter/exit spans out, on the SAME open-stay state. The rules pinned
// here are the cooperation contract with the geofence receiver and the
// Flutter plugin's PresenceSampler.kt — change one, change all three.

const PIN = { lat: 6.4281, lng: 3.4219 };
const AT_PIN = { lat: 6.4281, lng: 3.4219 };
const FAR = { lat: 6.4461, lng: 3.4219 }; // ~2 km

const fix = (where: { lat: number; lng: number }, at: number, mocked: boolean | null = false) => ({
  ...where,
  accuracy: 10,
  timestamp: at,
  mocked,
});
const t = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi).getTime();
const LAGOS = 60;

describe('applyLocationSamples', () => {
  it('opens a stay on the first inside fix and holds it', () => {
    const r = applyLocationSamples(PIN, [fix(AT_PIN, t(2026, 9, 3, 9))], null, LAGOS);
    expect(r.enterAt).toBe(t(2026, 9, 3, 9));
    expect(r.observations).toEqual([]);
    // A later inside fix within the check-in interval does not re-stamp:
    // the stay began at the first one.
    const again = applyLocationSamples(PIN, [fix(AT_PIN, t(2026, 9, 3, 11))], r.enterAt, LAGOS);
    expect(again.enterAt).toBe(t(2026, 9, 3, 9));
    expect(again.observations).toEqual([]);
  });

  it('checks in on a long stay: folds it so far and restarts it at the reading', () => {
    const r = applyLocationSamples(PIN, [fix(AT_PIN, t(2026, 9, 3, 12))], t(2026, 9, 3, 9), LAGOS);
    expect(r.enterAt).toBe(t(2026, 9, 3, 12));
    expect(r.observations).toEqual([
      { day: '2026-09-03', dwellMinutes: 180, nightPresent: false, source: 'geofence', samples: 1 },
    ]);
  });

  it('records someone who never leaves, one check-in at a time', () => {
    // Home from Friday 18:00 through Monday 08:00 with no exit at all: every
    // day is still credited, where before only the first 24 hours could be.
    const fixes = [];
    for (let h = 18; h <= 18 + 62; h += 3) fixes.push(fix(AT_PIN, t(2026, 9, 4, 18) + (h - 18) * 3600_000));
    const r = applyLocationSamples(PIN, fixes, null, LAGOS);
    expect(r.observations.map((o) => o.day)).toEqual(['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07']);
    expect(r.observations.every((o) => o.nightPresent)).toBe(true);
    expect(r.observations.find((o) => o.day === '2026-09-05')?.dwellMinutes).toBe(1440);
  });

  it('closes a stay on the first outside fix and folds the span', () => {
    const r = applyLocationSamples(PIN, [fix(FAR, t(2026, 9, 3, 11, 30))], t(2026, 9, 3, 9), LAGOS);
    expect(r.enterAt).toBeNull();
    expect(r.observations).toEqual([
      { day: '2026-09-03', dwellMinutes: 150, nightPresent: false, source: 'geofence', samples: 1 },
    ]);
  });

  it('respects a stay the geofence tier already opened', () => {
    // enterAt stamped by the OS ENTER event; the sampler's outside fix closes it.
    const opened = t(2026, 9, 3, 22);
    const r = applyLocationSamples(PIN, [fix(FAR, t(2026, 9, 4, 7))], opened, LAGOS);
    expect(r.observations.map((o) => o.day)).toEqual(['2026-09-03', '2026-09-04']);
    expect(r.observations.every((o) => o.nightPresent)).toBe(true);
  });

  it('is absence-blind: outside fixes with no open stay produce nothing', () => {
    const r = applyLocationSamples(PIN, [fix(FAR, t(2026, 9, 3, 9)), fix(FAR, t(2026, 9, 3, 18))], null, LAGOS);
    expect(r).toEqual({ enterAt: null, observations: [] });
  });

  it('sorts a batch by time before applying it', () => {
    const r = applyLocationSamples(
      PIN,
      [fix(FAR, t(2026, 9, 3, 12)), fix(AT_PIN, t(2026, 9, 3, 9))],
      null,
      LAGOS,
    );
    expect(r.enterAt).toBeNull();
    expect(r.observations[0]).toMatchObject({ day: '2026-09-03', dwellMinutes: 180 });
  });

  it('reports a mocked fix flagged and never opens a stay on it', () => {
    const r = applyLocationSamples(PIN, [fix(AT_PIN, t(2026, 9, 3, 22), true)], null, LAGOS);
    expect(r.enterAt).toBeNull();
    expect(r.observations).toEqual([
      {
        day: '2026-09-03',
        source: 'geofence',
        dwellMinutes: 0,
        nightPresent: true,
        samples: 1,
        integrity: { mockLocation: true },
      },
    ]);
  });
});

describe('mergeObservations', () => {
  it('folds same-day entries: sum dwell, OR night, sum samples, keep flags', () => {
    const merged = mergeObservations(
      [{ day: '2026-09-03', source: 'geofence', dwellMinutes: 60, nightPresent: false, samples: 1 }],
      [
        { day: '2026-09-03', source: 'geofence', dwellMinutes: 30, nightPresent: true, samples: 1, integrity: { mockLocation: true } },
        { day: '2026-09-04', source: 'geofence', dwellMinutes: 10, nightPresent: false, samples: 1 },
      ],
    );
    expect(merged).toEqual([
      { day: '2026-09-03', source: 'geofence', dwellMinutes: 90, nightPresent: true, samples: 2, integrity: { mockLocation: true } },
      { day: '2026-09-04', source: 'geofence', dwellMinutes: 10, nightPresent: false, samples: 1 },
    ]);
  });
});
