// ---------------------------------------------------------------------------
// The FOREGROUND presence reporter — the default tier, no background
// permission. The host app calls reportAddressPresence() on app open, or the
// moment the flow submits (watch-wait.ts makes that safe: the watch is minted
// seconds after the submission is accepted, and a fresh pin waits for it);
// the SDK takes one while-in-use fix, evaluates the fence ON-DEVICE against
// the pin stored at capture, and posts a single per-day aggregate. Everything is best-effort: a denied permission, a missing pin, or
// a network fault returns a reason, never a throw — a presence report must
// never break the host app's startup path.
// ---------------------------------------------------------------------------

import * as Location from 'expo-location';
import { currentPosition } from '../services/location';
import { insideFence, localDayAndNight } from './math';
import { postObservations } from './post';
import { loadPresencePin } from './store';
import { awaitWatch, fetchWatchStatus, pinIsFresh } from './watch-wait';

export interface ReportPresenceOptions {
  /** The org's PUBLISHABLE key (the same one the KYC flow mounts with). */
  apiKey: string;
  /** The org's user reference — must match the KYC flow's `userId`. */
  externalUserId: string;
  /** Dev-server override, exactly like the SDK config's `devUrl`. */
  devUrl?: string;
}

export interface ReportPresenceResult {
  reported: boolean;
  /** Whether the fix landed inside the fence (null when nothing was reported). */
  inside: boolean | null;
  reason:
    | 'reported'
    | 'no_pin'
    | 'services_off'
    | 'no_fix'
    | 'outside_fence'
    /** Nothing is monitoring this user right now, so a report would be dropped. */
    | 'no_watch'
    | 'network_error';
}

export async function reportAddressPresence(
  options: ReportPresenceOptions,
): Promise<ReportPresenceResult> {
  const pin = loadPresencePin(options.externalUserId);
  if (!pin) return { reported: false, inside: null, reason: 'no_pin' };

  // The phone's location toggle, checked before the permission dance: off,
  // every fix fails, and `no_fix` told the host nothing about why.
  const services = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!services) return { reported: false, inside: null, reason: 'services_off' };

  const fix = await currentPosition();
  if (!fix) return { reported: false, inside: null, reason: 'no_fix' };

  const inside = insideFence(pin, fix);
  // An outside fix is NOT evidence of absence (people go to work) — the server
  // scores presence, never absence — so there is nothing worth sending.
  if (!inside && fix.mocked !== true) {
    return { reported: false, inside: false, reason: 'outside_fence' };
  }

  // The watch is minted seconds after a submission is accepted, and the
  // ingest drops a report that arrives before it (watch-wait.ts).
  const watch = await awaitWatch(pinIsFresh(pin), {
    fetchStatus: () => fetchWatchStatus(options.apiKey, options.devUrl, options.externalUserId),
  });
  if (watch === 'absent') return { reported: false, inside, reason: 'no_watch' };

  const { day, nightPresent } = localDayAndNight();
  // One wire path for both tiers (post.ts) — the request shape cannot fork.
  const ok = await postObservations(options.apiKey, options.devUrl, options.externalUserId, [
    {
      day,
      source: 'foreground',
      dwellMinutes: 0,
      nightPresent,
      samples: 1,
      // A mocked fix is REPORTED, flagged — evidence OF fraud is worth
      // more to the watch than silence.
      ...(fix.mocked === true ? { integrity: { mockLocation: true } } : {}),
    },
  ]);
  if (!ok) return { reported: false, inside, reason: 'network_error' };
  return { reported: true, inside, reason: 'reported' };
}
