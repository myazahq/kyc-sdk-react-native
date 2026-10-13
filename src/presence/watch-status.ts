// Where a user's presence check stands ON THE SERVER, for the host app to
// show. presenceStatus() answers for the phone (permissions, pin, tier); this
// answers for the check itself (running, verified, how far along).
//
// The server answers `not_started` for an unknown user, a business and a user
// with no check alike, on purpose, so `not_started` never says which. It never
// returns the pin, the address or a coordinate. The Flutter SDK's
// presence_watch_status.dart is the same read; keep the two in lockstep.

import { resolveBaseUrl } from '../services/resolveUrl';

/** The server's status words. `unknown` is a word this SDK build does not
 *  know yet; treat it as still in progress. */
export type PresenceWatchState =
  | 'not_started'
  | 'in_progress'
  | 'verified'
  | 'failed'
  | 'inconclusive'
  | 'expired'
  | 'revoked'
  | 'unknown';

export interface PresenceWatchStatus {
  state: PresenceWatchState;
  /** The server's own word for `state`, as sent. */
  rawStatus: string;
  startedAt: string | null;
  deadlineAt: string | null;
  decidedAt: string | null;
  /** 0..1 of the way to verified, on weighted evidence. Null with no check. */
  progress: number | null;
  nightsObserved: number | null;
  daysObserved: number | null;
  /** Which kind of evidence has arrived so far (the server's word), if any. */
  tier: string | null;
  alwaysOn: boolean;
  nextCycleAt: string | null;
  /** The organisation stopped monitoring and nothing has started since. */
  stopped: boolean;
}

const STATES: ReadonlySet<string> = new Set([
  'not_started',
  'in_progress',
  'verified',
  'failed',
  'inconclusive',
  'expired',
  'revoked',
]);

const text = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const whole = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;

/** Pure: the response body as a status, or null when it carries no status. */
export function parsePresenceWatchStatus(body: unknown): PresenceWatchStatus | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const raw = b['status'];
  if (typeof raw !== 'string') return null;
  const p =
    b['progress'] && typeof b['progress'] === 'object'
      ? (b['progress'] as Record<string, unknown>)
      : null;
  const score = p?.['score'];
  return {
    state: STATES.has(raw) ? (raw as PresenceWatchState) : 'unknown',
    rawStatus: raw,
    startedAt: text(b['startedAt']),
    deadlineAt: text(b['deadlineAt']),
    decidedAt: text(b['decidedAt']),
    progress:
      typeof score === 'number' && Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : null,
    nightsObserved: whole(p?.['nightsObserved']),
    daysObserved: whole(p?.['daysObserved']),
    tier: text(b['tier']),
    alwaysOn: b['alwaysOn'] === true,
    nextCycleAt: text(b['nextCycleAt']),
    stopped: b['stopped'] === true || raw === 'revoked',
  };
}

/**
 * Reads the check's status with the publishable key. Never throws: null
 * means the server could not be reached or refused the key.
 */
export async function fetchPresenceWatchStatus(options: {
  apiKey: string;
  externalUserId: string;
  devUrl?: string;
}): Promise<PresenceWatchStatus | null> {
  try {
    const base = resolveBaseUrl(options.apiKey, options.devUrl);
    const response = await fetch(
      `${base}/api/v1/address/presence/${encodeURIComponent(options.externalUserId)}`,
      { headers: { Authorization: `Bearer ${options.apiKey}` } },
    );
    if (!response.ok) return null;
    return parsePresenceWatchStatus(await response.json());
  } catch {
    return null;
  }
}
