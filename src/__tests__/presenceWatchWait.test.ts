// The reporter reads its module's real dependencies only through resolveUrl;
// the rule under test is pure over the injected reader and clock.
import { awaitWatch, FRESH_PIN_MS, pinIsFresh, WATCH_POLL_MS, WATCH_WAIT_MS } from '../presence/watch-wait';

// ─── A submit-time report waits for its watch ───────────────────────────────
//
// The watch is minted seconds after the submission is accepted and the ingest
// drops anything posted before it, indistinguishably from an unknown user
// (iPhone + S24, 2026-09-07). A fresh pin waits; an old pin with no live watch
// is told so. A port of this file lives in the Flutter SDK
// (presence_watch_wait_test.dart) — keep the two in lockstep.

function clockAndReader(statuses: Array<string | null>) {
  let t = 1_000_000;
  const sleeps: number[] = [];
  const reads = [...statuses];
  const last = statuses[statuses.length - 1] ?? null;
  return {
    sleeps,
    deps: {
      fetchStatus: async () => (reads.length > 0 ? reads.shift()! : last),
      sleep: async (ms: number) => {
        sleeps.push(ms);
        t += ms;
      },
      now: () => t,
    },
  };
}

describe('awaitWatch', () => {
  it('a fresh pin waits through the previous cycle and the gap until the watch is live', async () => {
    const { deps, sleeps } = clockAndReader(['inconclusive', 'not_started', 'in_progress']);
    await expect(awaitWatch(true, deps)).resolves.toBe('live');
    expect(sleeps).toEqual([WATCH_POLL_MS, WATCH_POLL_MS]);
  });

  it('a fresh pin gives up at the deadline when no watch ever appears', async () => {
    const { deps, sleeps } = clockAndReader(['not_started']);
    await expect(awaitWatch(true, deps)).resolves.toBe('absent');
    expect(sleeps.length).toBe(WATCH_WAIT_MS / WATCH_POLL_MS);
  });

  it('a fresh pin keeps waiting through a failed read and reports unknown only if every read failed', async () => {
    const recovered = clockAndReader([null, 'in_progress']);
    await expect(awaitWatch(true, recovered.deps)).resolves.toBe('live');
    const dark = clockAndReader([null]);
    await expect(awaitWatch(true, dark.deps)).resolves.toBe('unknown');
  });

  it('an old pin reads once: live, absent, or unknown', async () => {
    await expect(awaitWatch(false, clockAndReader(['in_progress']).deps)).resolves.toBe('live');
    const absent = clockAndReader(['verified']);
    await expect(awaitWatch(false, absent.deps)).resolves.toBe('absent');
    expect(absent.sleeps).toEqual([]);
    await expect(awaitWatch(false, clockAndReader([null]).deps)).resolves.toBe('unknown');
  });
});

describe('pinIsFresh', () => {
  const now = Date.parse('2026-09-07T08:00:00Z');
  const savedAgo = (ms: number) => ({ savedAt: new Date(now - ms).toISOString() });

  it('is fresh inside the window and not past it', () => {
    expect(pinIsFresh(savedAgo(0), now)).toBe(true);
    expect(pinIsFresh(savedAgo(FRESH_PIN_MS), now)).toBe(true);
    expect(pinIsFresh(savedAgo(FRESH_PIN_MS + 1), now)).toBe(false);
  });

  it('an unparseable stamp is never fresh', () => {
    expect(pinIsFresh({ savedAt: 'yesterday' }, now)).toBe(false);
  });
});
