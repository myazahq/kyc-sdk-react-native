// ---------------------------------------------------------------------------
// Tier visibility + recovery. A revoked permission silently downgrades the
// presence tier, and "silently" is the defect: the host app cannot ask the
// person to restore what it does not know is gone. presenceStatus() answers
// "which tier is actually running for this user?", and openLocationSettings()
// is the only honest recovery path — neither OS allows re-prompting in-app
// after a denial, so the road back runs through Settings.
//
// The phone's LOCATION SERVICES toggle is checked as well as the permissions.
// Permission granted with the toggle off produced `no_fix` on every report
// and nothing said why; OkHi's integration guidance calls this out for the
// same reason. It is a first-class input to the tier (tier.ts).
// ---------------------------------------------------------------------------

import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { foregroundServiceRunning } from './foreground-service';
import { geofenceArmed } from './geofence';
import { loadPresencePin } from './store';
import { resolvePresenceTier, type PermissionState, type PresenceTier } from './tier';

export type { PresenceTier } from './tier';

export interface PresenceStatus {
  /** The tier that is ACTUALLY running, not the one that was asked for. */
  tier: PresenceTier;
  /** Whether a pin is stored for this user (without one, no tier can run). */
  pinStored: boolean;
  /** Whether the stored pin is the always-on arrangement. */
  alwaysOn: boolean;
  /** The phone's location services switch. Off, nothing can run whatever
   *  the permissions say; `openLocationSettings('services')` is the road back. */
  locationServicesEnabled: boolean;
  foregroundPermission: PermissionState;
  backgroundPermission: PermissionState;
  /** The geofence is registered with the OS right now. */
  geofenceArmed: boolean;
  /** The Android foreground service is running right now (always false on iOS). */
  foregroundServiceRunning: boolean;
}

function normalise(status: string | undefined): PermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function presenceStatus(externalUserId: string): Promise<PresenceStatus> {
  const pin = loadPresencePin(externalUserId);
  const [fg, bg, armed, services, service] = await Promise.all([
    Location.getForegroundPermissionsAsync().catch(() => null),
    Location.getBackgroundPermissionsAsync().catch(() => null),
    geofenceArmed(),
    // An unanswerable check reads as ON: the permissions below still gate,
    // and a false "off" would send people to Settings for nothing.
    Location.hasServicesEnabledAsync().catch(() => true),
    foregroundServiceRunning(),
  ]);
  const inputs = {
    pinStored: pin != null,
    locationServicesEnabled: services,
    foregroundPermission: normalise(fg?.status),
    backgroundPermission: normalise(bg?.status),
    geofenceArmed: armed,
    foregroundServiceRunning: service,
  };
  return {
    tier: resolvePresenceTier(inputs),
    alwaysOn: pin?.alwaysOn === true,
    ...inputs,
  };
}

/**
 * Deep-link to Settings — the only road back after a denial or a switched-off
 * toggle. `'app'` (default) opens the app's own settings page (permissions);
 * `'services'` opens the phone's location-services screen on Android, which
 * is where the toggle lives (iOS has no such deep link, so it falls back to
 * the app page). Never throws; a host may call it straight from a button.
 */
export async function openLocationSettings(target: 'app' | 'services' = 'app'): Promise<void> {
  try {
    if (target === 'services' && Platform.OS === 'android') {
      await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      return;
    }
    await Linking.openSettings();
  } catch {
    // Nothing to do: the OS refused, and the host's copy already told the
    // person where to go by hand.
  }
}
