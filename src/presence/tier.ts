// ---------------------------------------------------------------------------
// Which presence tier is ACTUALLY running, as one pure decision — so the
// answer presenceStatus() gives can be pinned without a device, and so the
// Flutter mirror (presence_tier.dart) can be held to the same table.
//
// The location-services toggle sits ABOVE every permission: with services
// off, a granted permission and an armed fence produce no fix and no
// transition, so nothing is running whatever the grants say. That was the
// silent case — permission granted, toggle off, `no_fix` forever — and it is
// why the switch is a first-class input here rather than folded into one of
// the permission states.
// ---------------------------------------------------------------------------

export type PresenceTier = 'background' | 'foreground' | 'none';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface TierInputs {
  pinStored: boolean;
  locationServicesEnabled: boolean;
  foregroundPermission: PermissionState;
  backgroundPermission: PermissionState;
  /** The OS geofence is registered right now. */
  geofenceArmed: boolean;
  /** The Android foreground service is running right now. */
  foregroundServiceRunning: boolean;
}

export function resolvePresenceTier(i: TierInputs): PresenceTier {
  if (!i.pinStored || !i.locationServicesEnabled) return 'none';
  if (i.backgroundPermission === 'granted' && (i.geofenceArmed || i.foregroundServiceRunning)) {
    return 'background';
  }
  if (i.foregroundPermission === 'granted') return 'foreground';
  return 'none';
}
