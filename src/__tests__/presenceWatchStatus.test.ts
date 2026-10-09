import { parsePresenceWatchStatus } from '../presence/watch-status';

// The body is the server's PresenceStatusView (kyc-core,
// src/lib/address-intel/presence/status.ts). A port of the Flutter SDK's
// presence_watch_status_test.dart; keep the two in lockstep.

describe('parsePresenceWatchStatus', () => {
  it('reads a running check: progress, counts and dates', () => {
    const s = parsePresenceWatchStatus({
      status: 'in_progress',
      watchId: 'aw_1',
      startedAt: '2026-10-01T08:00:00.000Z',
      deadlineAt: '2026-10-08T08:00:00.000Z',
      decidedAt: null,
      progress: { score: 0.4, nightsObserved: 2, daysObserved: 2 },
      tier: 'foreground',
      alwaysOn: true,
      nextCycleAt: null,
      stopped: false,
    });
    expect(s).toMatchObject({
      state: 'in_progress',
      progress: 0.4,
      nightsObserved: 2,
      daysObserved: 2,
      tier: 'foreground',
      alwaysOn: true,
      deadlineAt: '2026-10-08T08:00:00.000Z',
      decidedAt: null,
      stopped: false,
    });
  });

  it('answers not_started with nothing else when there is no check', () => {
    const s = parsePresenceWatchStatus({ status: 'not_started', progress: null });
    expect(s?.state).toBe('not_started');
    expect(s?.progress).toBeNull();
    expect(s?.nightsObserved).toBeNull();
  });

  it('treats a revoked check as stopped even without the flag', () => {
    expect(parsePresenceWatchStatus({ status: 'revoked' })?.stopped).toBe(true);
    expect(parsePresenceWatchStatus({ status: 'verified', stopped: true })?.stopped).toBe(true);
  });

  it('keeps a status word this build does not know, as unknown', () => {
    const s = parsePresenceWatchStatus({ status: 'paused' });
    expect(s?.state).toBe('unknown');
    expect(s?.rawStatus).toBe('paused');
  });

  it('is null without a status, and clamps a score outside 0..1', () => {
    expect(parsePresenceWatchStatus(null)).toBeNull();
    expect(parsePresenceWatchStatus({ progress: {} })).toBeNull();
    expect(parsePresenceWatchStatus({ status: 'verified', progress: { score: 1.4 } })?.progress).toBe(1);
  });
});
