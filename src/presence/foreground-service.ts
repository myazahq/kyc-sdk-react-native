// ---------------------------------------------------------------------------
// The Android FOREGROUND SERVICE tier — the OkHi reliability move. A geofence
// alone is not reliable on Android 8+ once a manufacturer's battery manager
// decides an app is idle: transitions are dropped and nothing says so, the
// watch quietly lapses to inconclusive, and the phones on that list (Tecno,
// Infinix, itel, Xiaomi, Oppo, Vivo) are the ones our markets carry.
//
// A foreground service, with its persistent notification, is the one thing
// those managers leave alone. expo-location runs one for location updates;
// this file drives it: periodic low-power fixes arrive in a headless task,
// sampler.ts turns them into the same enter/exit spans the geofence tier
// folds (on the SAME stored enterAt, so the two cooperate), the queue flushes
// while the process is alive, and a dropped fence is re-armed.
//
// Android only, opt-in, and the notification is the HOST's to word — its
// title and body reach the person's status bar. On iOS the geofence tier is
// reliable on its own; asking for continuous background updates there would
// be the heavier posture for nothing, so enable() answers unsupported.
// ---------------------------------------------------------------------------

import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { armGeofence, geofenceArmed } from './geofence';
import { applyLocationSamples, mergeObservations } from './sampler';
import { postObservations } from './post';
import { loadPresencePin } from './store';
import {
  loadEnterAt,
  loadReporterConfig,
  loadServiceUser,
  pendingObservations,
  queueObservations,
  replacePending,
  saveEnterAt,
  saveReporterConfig,
  saveServiceUser,
} from './background-store';

export const PRESENCE_LOCATION_TASK = 'myaza-kyc-presence-location';

/** Low-power cadence: a fix every ten minutes or hundred metres is plenty to
 *  bracket a stay to the dwell floor, and cheap enough to run for a week. */
const SAMPLE_INTERVAL_MS = 10 * 60 * 1000;
const SAMPLE_DISTANCE_M = 100;

export interface PresenceNotification {
  /** e.g. "Address verification in progress" */
  title: string;
  /** e.g. "Check the app to see your progress" */
  body: string;
  /** `#RRGGBB`; the notification accent. */
  color?: string;
}

interface TaskManagerLike {
  defineTask(name: string, fn: (body: { data: unknown; error: unknown }) => void): void;
}

type LocationLike = {
  coords: { latitude: number; longitude: number; accuracy?: number | null };
  timestamp?: number;
  mocked?: boolean;
};

async function flushQueue(userId: string): Promise<void> {
  const cfg = loadReporterConfig(userId);
  if (!cfg) return;
  const pending = pendingObservations(userId);
  if (pending.length === 0) return;
  const ok = await postObservations(cfg.apiKey, cfg.devUrl, userId, pending);
  if (ok) replacePending(userId, []);
}

/** Define the location task. Called by registerBackgroundPresence(), so the
 *  host's one root-level call covers both background tiers. */
export function defineLocationTask(tm: TaskManagerLike): void {
  tm.defineTask(PRESENCE_LOCATION_TASK, (body) => {
    if (body.error) return;
    const locations = (body.data as { locations?: LocationLike[] } | undefined)?.locations;
    if (!Array.isArray(locations) || locations.length === 0) return;
    const userId = loadServiceUser();
    if (!userId) return;
    const pin = loadPresencePin(userId);
    if (!pin) return;

    const result = applyLocationSamples(
      pin,
      locations.map((l) => ({
        lat: l.coords.latitude,
        lng: l.coords.longitude,
        accuracy: typeof l.coords.accuracy === 'number' ? l.coords.accuracy : null,
        timestamp: l.timestamp ?? Date.now(),
        mocked: typeof l.mocked === 'boolean' ? l.mocked : null,
      })),
      loadEnterAt(userId),
    );
    saveEnterAt(userId, result.enterAt);
    if (result.observations.length > 0) {
      queueObservations(userId, result.observations, mergeObservations);
    }
    // A live process is the one moment a stuck queue (an EXIT flush that met
    // no network) can drain, and a dropped fence can come back.
    void flushQueue(userId);
    void geofenceArmed().then((armed) => {
      if (!armed) armGeofence(userId, pin).catch(() => undefined);
    });
  });
}

export interface EnableForegroundServiceResult {
  enabled: boolean;
  reason:
    | 'enabled'
    | 'unsupported_platform'
    | 'module_missing'
    | 'no_pin'
    | 'foreground_denied'
    | 'background_denied'
    | 'start_failed';
}

/**
 * Start the service on the stored pin. Asks for foreground THEN background
 * permission (the order the OSes require); a refusal leaves whichever tier
 * was running exactly as before — the tiers degrade, never break.
 */
export async function enableForegroundService(options: {
  apiKey: string;
  externalUserId: string;
  devUrl?: string;
  notification: PresenceNotification;
}): Promise<EnableForegroundServiceResult> {
  if (Platform.OS !== 'android') return { enabled: false, reason: 'unsupported_platform' };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-task-manager');
  } catch {
    return { enabled: false, reason: 'module_missing' };
  }
  const pin = loadPresencePin(options.externalUserId);
  if (!pin) return { enabled: false, reason: 'no_pin' };

  const fg = await Location.requestForegroundPermissionsAsync().catch(() => null);
  if (fg?.status !== 'granted') return { enabled: false, reason: 'foreground_denied' };
  const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
  if (bg?.status !== 'granted') return { enabled: false, reason: 'background_denied' };

  saveReporterConfig(options.externalUserId, {
    apiKey: options.apiKey,
    ...(options.devUrl ? { devUrl: options.devUrl } : {}),
  });
  saveServiceUser(options.externalUserId);

  try {
    await Location.startLocationUpdatesAsync(PRESENCE_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: SAMPLE_INTERVAL_MS,
      distanceInterval: SAMPLE_DISTANCE_M,
      deferredUpdatesInterval: SAMPLE_INTERVAL_MS,
      foregroundService: {
        notificationTitle: options.notification.title,
        notificationBody: options.notification.body,
        ...(options.notification.color ? { notificationColor: options.notification.color } : {}),
        // The service outliving a swipe-away is the whole point.
        killServiceOnDestroy: false,
      },
    });
    return { enabled: true, reason: 'enabled' };
  } catch {
    saveServiceUser(null);
    return { enabled: false, reason: 'start_failed' };
  }
}

/** Stop the service and its notification. Never throws. */
export async function disableForegroundService(): Promise<void> {
  saveServiceUser(null);
  try {
    await Location.stopLocationUpdatesAsync(PRESENCE_LOCATION_TASK);
  } catch {
    // Not running, or the module is absent — either way, stopped.
  }
}

/** Whether the service is running right now. Never throws. */
export async function foregroundServiceRunning(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(PRESENCE_LOCATION_TASK);
  } catch {
    return false;
  }
}
