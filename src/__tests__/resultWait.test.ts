import { awaitVerificationOutcome, isPendingStatus } from '../lib/result-wait';
import type { VerificationStatusResponse } from '../services/api-types';

const read = (status: VerificationStatusResponse['status'], extra: Partial<VerificationStatusResponse> = {}): VerificationStatusResponse =>
  ({ verificationId: 'ver_1', status, createdAt: '2026-09-07T00:00:00Z', ...extra });

// A fake clock: every sleep advances time by the requested amount.
function harness(reads: Array<VerificationStatusResponse | null>) {
  let t = 0;
  const sleeps: number[] = [];
  const queue = [...reads];
  return {
    deps: {
      fetchStatus: async () => (queue.length ? queue.shift()! : null),
      sleep: async (ms: number) => { sleeps.push(ms); t += ms; },
      now: () => t,
      waitMs: 10_000,
      pollMs: 1000,
    },
    sleeps,
  };
}

describe('awaitVerificationOutcome', () => {
  it('polls through the pending states and settles on the verdict', async () => {
    const h = harness([read('processing'), read('processing'), read('declined', { reasonCode: 'biometric_auth_failed', reason: 'No match.' })]);
    await expect(awaitVerificationOutcome(h.deps)).resolves.toEqual({
      kind: 'settled', status: 'declined', reason: 'No match.', reasonCode: 'biometric_auth_failed',
    });
    expect(h.sleeps).toEqual([1000, 1000]);
  });

  it('a failed read is skipped, never taken as a verdict', async () => {
    const h = harness([null, read('approved')]);
    await expect(awaitVerificationOutcome(h.deps)).resolves.toMatchObject({ kind: 'settled', status: 'approved', reason: null });
  });

  it('gives up at the deadline while still pending', async () => {
    const h = harness(Array.from({ length: 20 }, () => read('processing')));
    await expect(awaitVerificationOutcome(h.deps)).resolves.toEqual({ kind: 'timeout' });
    expect(h.sleeps.length).toBe(10);
  });

  it('review and error settle the wait like a verdict does', async () => {
    await expect(awaitVerificationOutcome(harness([read('in_review')]).deps)).resolves.toMatchObject({ status: 'in_review' });
    await expect(awaitVerificationOutcome(harness([read('error', { reasonCode: 'system_error' })]).deps)).resolves.toMatchObject({ reasonCode: 'system_error' });
  });

  it('names the pending states', () => {
    expect(['not_started', 'in_progress', 'processing'].map((s) => isPendingStatus(s as never))).toEqual([true, true, true]);
    expect(isPendingStatus('approved')).toBe(false);
  });
});

describe('describeWaiting', () => {
  const { describeWaiting } = require('../lib/result-copy') as typeof import('../lib/result-copy');
  it('names the check on a re-authentication that waits, and the step elsewhere', () => {
    expect(describeWaiting({ scope: 'biometric-authentication', waitsForResult: true }).title).toBe("Checking it's you");
    expect(describeWaiting({ scope: 'biometric-authentication', waitsForResult: false }).title).toBe('Sending your face check');
    expect(describeWaiting({ scope: 'biometric-enrollment', waitsForResult: false }).title).toBe('Saving your selfie');
    expect(describeWaiting({ scope: null, waitsForResult: false }).title).toBe('Submitting your verification');
  });
  it('a retry in flight swaps the description and keeps the title', () => {
    const c = describeWaiting({ scope: 'biometric-authentication', waitsForResult: true, retry: { attempt: 2, total: 3 } });
    expect(c.title).toBe("Checking it's you");
    expect(c.description).toBe('Connection issue, retrying (2/3).');
  });
  it("the org's own words replace the default field by field, and a retry keeps the custom title", () => {
    const custom = describeWaiting({
      scope: 'biometric-authentication',
      waitsForResult: true,
      override: { title: 'One moment, Ada' },
    });
    expect(custom.title).toBe('One moment, Ada');
    expect(custom.description).toBe('Matching your selfie against the photo on record. This usually takes a few seconds.');
    const retrying = describeWaiting({
      scope: 'biometric-authentication',
      waitsForResult: true,
      retry: { attempt: 2, total: 3 },
      override: { title: 'One moment, Ada', description: 'Hold still.' },
    });
    expect(retrying.title).toBe('One moment, Ada');
    expect(retrying.description).toBe('Connection issue, retrying (2/3).');
    expect(describeWaiting({ scope: 'biometric-enrollment', waitsForResult: false, override: null }).title).toBe('Saving your selfie');
  });

  it('carries no em dash', () => {
    for (const scope of ['biometric-authentication', 'biometric-enrollment', null]) {
      for (const waits of [true, false]) {
        const c = describeWaiting({ scope, waitsForResult: waits, retry: { attempt: 1, total: 3 } });
        expect(`${c.title} ${c.description}`).not.toContain('—');
      }
    }
  });
});

describe('describeOutcome', () => {
  const { describeOutcome } = require('../lib/result-copy') as typeof import('../lib/result-copy');
  it('speaks to each outcome, preferring the server reason on a decline', () => {
    expect(describeOutcome({ kind: 'settled', status: 'approved', reason: null, reasonCode: null })).toMatchObject({ tone: 'success', title: "You're verified" });
    expect(describeOutcome({ kind: 'settled', status: 'declined', reason: 'Your selfie did not match.', reasonCode: 'biometric_auth_failed' })).toMatchObject({ tone: 'error', description: 'Your selfie did not match.' });
    expect(describeOutcome({ kind: 'settled', status: 'in_review', reason: null, reasonCode: null }).tone).toBe('info');
    expect(describeOutcome({ kind: 'timeout' })).toMatchObject({ tone: 'info', title: 'Still checking' });
  });
  it("the org's own words replace the verdict screens, its declined description over the server reason", () => {
    const copy = {
      verified: { title: 'Welcome back, Ada', description: 'You are signed in.' },
      declined: { description: 'Try again in better light.' },
    };
    const ok = describeOutcome({ kind: 'settled', status: 'approved', reason: null, reasonCode: null }, copy);
    expect(ok).toEqual({ tone: 'success', title: 'Welcome back, Ada', description: 'You are signed in.' });
    const no = describeOutcome({ kind: 'settled', status: 'declined', reason: 'The selfie did not match.', reasonCode: 'x' }, copy);
    expect(no.title).toBe("We couldn't confirm it's you");
    expect(no.description).toBe('Try again in better light.');
    expect(describeOutcome({ kind: 'timeout' }, copy).title).toBe('Still checking');
  });

  it('carries no em dash in anything the person reads', () => {
    for (const o of [
      { kind: 'settled' as const, status: 'approved' as const, reason: null, reasonCode: null },
      { kind: 'settled' as const, status: 'declined' as const, reason: null, reasonCode: null },
      { kind: 'settled' as const, status: 'error' as const, reason: null, reasonCode: null },
      { kind: 'timeout' as const },
    ]) {
      const c = describeOutcome(o);
      expect(`${c.title} ${c.description}`).not.toContain('—');
    }
  });
});
