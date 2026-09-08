// ---------------------------------------------------------------------------
// The one geofence primitive both background tiers share. The OS-geofence
// tier arms it at enable time; the foreground-service tier re-arms it when a
// location batch finds the fence has been dropped (a location-services toggle
// clears every registered fence on Android, silently). Kept apart from
// background.ts so foreground-service.ts can import it without a cycle.
// ---------------------------------------------------------------------------

import * as Location from 'expo-location';

export const PRESENCE_GEOFENCE_TASK = 'myaza-kyc-presence-geofence';

/** The server's at-address rule: 250m, so the fence and the scorer agree on
 *  what counts as "at the address". */
export const GEOFENCE_RADIUS_M = 250;

/** Registers the fence on the pin. Throws on failure; callers decide. */
export function armGeofence(
  externalUserId: string,
  pin: { lat: number; lng: number },
): Promise<void> {
  return Location.startGeofencingAsync(PRESENCE_GEOFENCE_TASK, [
    {
      identifier: externalUserId,
      latitude: pin.lat,
      longitude: pin.lng,
      radius: GEOFENCE_RADIUS_M,
      notifyOnEnter: true,
      notifyOnExit: true,
    },
  ]);
}

/** Whether the fence is registered with the OS right now. Never throws. */
export async function geofenceArmed(): Promise<boolean> {
  try {
    return await Location.hasStartedGeofencingAsync(PRESENCE_GEOFENCE_TASK);
  } catch {
    return false;
  }
}
