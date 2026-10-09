// ---------------------------------------------------------------------------
// Standing down. The organisation (or Myaza) can stop a customer's presence
// monitoring, and until now nothing told the phone: the geofence stayed
// armed, the Android foreground service kept its notification up, and the
// stored pin stayed on the device, all reporting to a watch that no longer
// existed. When the status read says monitoring was stopped, the SDK switches
// off its own side for THAT user and forgets the pin.
//
// Only the tiers this user owns are touched: a shared device may be running
// monitoring for somebody else. Never throws. Mirrors the Flutter SDK's
// presence_stand_down.dart; keep the two in lockstep.
// ---------------------------------------------------------------------------

import { disableBackgroundPresence } from './background';
import { loadFenceUser, loadServiceUser } from './background-store';
import { disableForegroundService } from './foreground-service';
import { clearPresencePin } from './store';

export interface StandDownResult {
  geofence: boolean;
  foregroundService: boolean;
}

export async function standDownPresence(externalUserId: string): Promise<StandDownResult> {
  const result: StandDownResult = { geofence: false, foregroundService: false };
  try {
    if (loadFenceUser() === externalUserId) {
      await disableBackgroundPresence();
      result.geofence = true;
    }
    if (loadServiceUser() === externalUserId) {
      await disableForegroundService();
      result.foregroundService = true;
    }
  } catch {
    // Best-effort: the pin is still forgotten below, which is what stops reports.
  }
  clearPresencePin(externalUserId);
  return result;
}
