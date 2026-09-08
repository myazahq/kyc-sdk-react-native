import type { SessionStatus, VerificationStatusResponse } from '../services/api-types';

// ─── Waiting for a verdict in the flow ──────────────────────────────────────
//
// The platform is fire-and-forget: /verify answers in milliseconds and the
// worker settles the check afterwards. A re-authentication is the one flow
// whose verdict the person is waiting for RIGHT THERE, so the submitted step
// polls the publishable status endpoint (state + reason, never result data)
// until the check leaves its pending states. Pure and injectable, like the
// presence watch wait: the screen owns nothing but the rendering.

export const RESULT_WAIT_MS = 60 * 1000;
export const RESULT_POLL_MS = 1500;

/** The states a submitted check passes through before it settles. */
const PENDING: ReadonlySet<SessionStatus> = new Set(['not_started', 'in_progress', 'processing']);

export type VerificationOutcome =
  | { kind: 'settled'; status: SessionStatus; reason: string | null; reasonCode: string | null }
  | { kind: 'timeout' };

export interface AwaitOutcomeDeps {
  /** One status read; null on any failure (the wait keeps going). */
  fetchStatus: () => Promise<VerificationStatusResponse | null>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  waitMs?: number;
  pollMs?: number;
}

export function isPendingStatus(status: SessionStatus): boolean {
  return PENDING.has(status);
}

/**
 * Poll until the check settles or the budget runs out. A failed read is not
 * a verdict: it is skipped and the next poll tries again, so a network blip
 * mid-wait never reads as an outcome.
 */
export async function awaitVerificationOutcome(deps: AwaitOutcomeDeps): Promise<VerificationOutcome> {
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? Date.now;
  const deadline = now() + (deps.waitMs ?? RESULT_WAIT_MS);
  const pollMs = deps.pollMs ?? RESULT_POLL_MS;
  for (;;) {
    const read = await deps.fetchStatus();
    if (read && !isPendingStatus(read.status)) {
      return { kind: 'settled', status: read.status, reason: read.reason ?? null, reasonCode: read.reasonCode ?? null };
    }
    if (now() >= deadline) return { kind: 'timeout' };
    await sleep(pollMs);
  }
}
