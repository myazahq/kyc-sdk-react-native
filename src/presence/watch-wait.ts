// ---------------------------------------------------------------------------
// Waiting for the watch. The server mints an AddressWatch in the post-terminal
// hook chain, seconds AFTER a submission is accepted, and its ingest is
// enumeration-safe by contract: an observation for a user with no live watch
// answers `accepted: 0` exactly as an unknown user would, and is dropped. So
// a report made the moment onSubmit fires — the natural place for a host to
// make one — landed on nothing (iPhone + S24, 2026-09-07: three watches in a
// row lapsed INCONCLUSIVE with zero observations while both phones sat at the
// pin). The reporter therefore asks where the watch stands before it posts,
// and when the pin was captured minutes ago it WAITS for the watch to appear,
// bounded, rather than posting into the gap. Mirrors the Flutter SDK's
// presence_watch_wait.dart — keep the two in lockstep.
// ---------------------------------------------------------------------------

import { resolveBaseUrl } from '../services/resolveUrl';

/** A pin saved this recently was captured by a flow whose watch may still be minting. */
export const FRESH_PIN_MS = 15 * 60 * 1000;
/** How long a submit-time report waits for its watch before giving up. */
export const WATCH_WAIT_MS = 90 * 1000;
export const WATCH_POLL_MS = 3 * 1000;

export type WatchPresence = 'live' | 'absent' | 'unknown';

export function pinIsFresh(pin: { savedAt: string }, nowMs: number = Date.now()): boolean {
  const saved = Date.parse(pin.savedAt);
  return !Number.isNaN(saved) && nowMs - saved <= FRESH_PIN_MS;
}

/** The server's public status for the user's watch, or null when it could not be read. */
export async function fetchWatchStatus(
  apiKey: string,
  devUrl: string | undefined,
  externalUserId: string,
): Promise<string | null> {
  try {
    const base = resolveBaseUrl(apiKey, devUrl);
    const response = await fetch(
      `${base}/api/kyc/address/presence/${encodeURIComponent(externalUserId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { status?: unknown };
    return typeof body.status === 'string' ? body.status : null;
  } catch {
    return null;
  }
}

export interface AwaitWatchDeps {
  fetchStatus: () => Promise<string | null>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  waitMs?: number;
  pollMs?: number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Whether a live watch exists to receive a report. Only `in_progress` is
 * live: a resolved cycle, or none at all, drops what is posted. An
 * unreadable status is `unknown`, and the post goes ahead — a network doubt
 * must not silence a report the server might accept. A FRESH pin changes the
 * rule: its watch is probably still being minted (or the previous cycle has
 * just lapsed and the new one is about to replace it), so the status is
 * re-read until it turns live or the wait runs out.
 */
export async function awaitWatch(fresh: boolean, deps: AwaitWatchDeps): Promise<WatchPresence> {
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;
  const deadline = now() + (deps.waitMs ?? WATCH_WAIT_MS);
  const pollMs = deps.pollMs ?? WATCH_POLL_MS;
  for (;;) {
    const status = await deps.fetchStatus();
    if (status === 'in_progress') return 'live';
    if (!fresh) return status === null ? 'unknown' : 'absent';
    if (now() >= deadline) return status === null ? 'unknown' : 'absent';
    await sleep(pollMs);
  }
}
