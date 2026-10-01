import { KYCApiError } from '../services/api';
import { mapToKycError } from '../services/errors';
import { recoveryStepFor, serverRefusalOf } from '../lib/submit-recovery';
import { awaitVerificationOutcome, isPendingStatus } from '../lib/result-wait';
import { describeOutcome } from '../lib/result-copy';
import {
  CANCELLED_TITLE,
  DEFAULT_CANCELLED_MESSAGE,
  cancelledRefusalOf,
  isCancelledStatus,
  shouldStopOnSessionStartFailure,
} from '../lib/session-cancelled';
import type { KYCStep } from '../types/config';
import type { VerificationStatusResponse } from '../services/api-types';

// An organisation can cancel a verification session midway. The server then
// answers 409 { error: 'session_cancelled', message } from /session/start,
// /session/:id/progress and /verify, and status 'cancelled' from /status/:id.
// Retrying can never succeed, so no path may offer Try again for it.

const SERVER_MESSAGE =
  'This verification was cancelled. Contact the organisation that sent it if you think this is a mistake.';

const cancelled = (body: Record<string, unknown> = { error: 'session_cancelled', message: SERVER_MESSAGE }) =>
  new KYCApiError(String(body.message ?? body.error), 409, 'session_cancelled', body);

describe('cancelledRefusalOf', () => {
  it('reads the server message off a session_cancelled refusal', () => {
    expect(cancelledRefusalOf(cancelled())).toEqual({ message: SERVER_MESSAGE });
  });

  it('falls back to the default sentence when the server sent none', () => {
    expect(cancelledRefusalOf(cancelled({ error: 'session_cancelled' }))).toEqual({
      message: DEFAULT_CANCELLED_MESSAGE,
    });
    expect(cancelledRefusalOf(cancelled({ error: 'session_cancelled', message: '   ' }))).toEqual({
      message: DEFAULT_CANCELLED_MESSAGE,
    });
  });

  it('ignores every other failure, including other 409s', () => {
    expect(cancelledRefusalOf(new KYCApiError('used', 409, 'handoff_session_used'))).toBeNull();
    expect(cancelledRefusalOf(new KYCApiError('x', 500))).toBeNull();
    expect(cancelledRefusalOf(new TypeError('Network request failed'))).toBeNull();
    expect(cancelledRefusalOf(null)).toBeNull();
  });
});

describe('mapToKycError', () => {
  it('maps a session_cancelled refusal to its own code, in either context', () => {
    for (const context of ['verify', 'upload'] as const) {
      const e = mapToKycError(cancelled(), context);
      expect(e.code).toBe('session_cancelled');
      expect(e.message).toBe(SERVER_MESSAGE);
    }
  });

  it('never words a cancellation as something to try again', () => {
    expect(mapToKycError(cancelled({ error: 'session_cancelled' }), 'verify').message).not.toMatch(/try again/i);
  });

  it('leaves other 409s on the generic path', () => {
    expect(mapToKycError(new KYCApiError('used', 409, 'handoff_session_used'), 'verify').code).toBe('unknown');
  });
});

describe('shouldStopOnSessionStartFailure', () => {
  it('stops the flow on a cancellation', () => {
    expect(shouldStopOnSessionStartFailure(cancelled())).toBe(true);
  });

  it('keeps every other start failure best-effort', () => {
    expect(shouldStopOnSessionStartFailure(new KYCApiError('x', 500))).toBe(false);
    expect(shouldStopOnSessionStartFailure(new KYCApiError('x', 401))).toBe(false);
    expect(shouldStopOnSessionStartFailure(new KYCApiError('x', 409, 'session_unavailable'))).toBe(false);
    expect(shouldStopOnSessionStartFailure(new TypeError('Network request failed'))).toBe(false);
  });
});

describe('submit recovery', () => {
  const order: KYCStep[] = ['consent', 'id-type', 'id-input', 'liveness', 'submitted'];

  it('reads the server code off a cancelled submission', () => {
    expect(serverRefusalOf(cancelled())).toEqual({ code: 'session_cancelled', mediaKey: null });
  });

  it('offers no Go back for a cancellation', () => {
    expect(recoveryStepFor('session_cancelled', order)).toBeNull();
  });
});

describe('the status poll', () => {
  const read = (status: VerificationStatusResponse['status'], extra: Partial<VerificationStatusResponse> = {}) =>
    ({ verificationId: 'ver_1', status, createdAt: '2026-10-01T00:00:00Z', ...extra }) as VerificationStatusResponse;

  it('treats cancelled as terminal', () => {
    expect(isPendingStatus('cancelled')).toBe(false);
    expect(isCancelledStatus('cancelled')).toBe(true);
    expect(isCancelledStatus('declined')).toBe(false);
  });

  it('settles on cancelled instead of waiting it out', async () => {
    const queue = [read('processing'), read('cancelled', { reason: SERVER_MESSAGE })];
    let t = 0;
    const sleeps: number[] = [];
    const outcome = await awaitVerificationOutcome({
      fetchStatus: async () => queue.shift() ?? null,
      sleep: async (ms) => {
        sleeps.push(ms);
        t += ms;
      },
      now: () => t,
      waitMs: 10_000,
      pollMs: 1000,
    });
    expect(outcome).toEqual({ kind: 'settled', status: 'cancelled', reason: SERVER_MESSAGE, reasonCode: null });
    expect(sleeps).toEqual([1000]);
  });

  it('words a cancelled outcome as cancelled, never as a retry', () => {
    const copy = describeOutcome({ kind: 'settled', status: 'cancelled', reason: null, reasonCode: null });
    expect(copy.title).toBe(CANCELLED_TITLE);
    expect(copy.description).toBe(DEFAULT_CANCELLED_MESSAGE);
    expect(copy.description).not.toMatch(/—/);
  });
});
