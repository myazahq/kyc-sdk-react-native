// ---------------------------------------------------------------------------
// The open stay, for the host app to show. The background tier sends nothing
// while a stay is merely running: it reports when the person leaves, or at a
// "still here" check-in (35 minutes after they arrive, then every three
// hours; background-math.ts). Between those moments the server has nothing
// new, so "0 days" on a dashboard can mean "inside since 18:04, first report
// due 18:39" rather than "broken". This is how a host says so.
//
// Read from the phone only. Nothing here leaves the device.
// ---------------------------------------------------------------------------

import { nextCheckpointAt } from './background-math';
import { loadStay, type StoredStay } from './background-store';

export interface PresenceStay {
  /** When the phone last arrived inside the fence (epoch ms). */
  since: number;
  /** The earliest moment a check-in can record this stay (epoch ms). The OS
   *  decides when a background check-in actually runs, so this is "not
   *  before", never a promise; opening the app after it records at once. */
  nextReportAt: number;
}

/** Pure: the stored stay as the host sees it; null with no stay open. */
export function stayFromStored(stored: StoredStay): PresenceStay | null {
  const next = nextCheckpointAt(stored.enterAt, stored.stayStart);
  if (stored.enterAt == null || next == null) return null;
  return { since: stored.stayStart ?? stored.enterAt, nextReportAt: next };
}

/** The stay the background tier has open for this user, or null. Never throws. */
export function presenceStay(externalUserId: string): PresenceStay | null {
  try {
    return stayFromStored(loadStay(externalUserId));
  } catch {
    return null;
  }
}
