// ---------------------------------------------------------------------------
// "Still here" check-ins for the background presence tier.
//
// A geofence only speaks when the person crosses its edge, so a stay was
// credited when they LEFT. Someone who hardly leaves home produced no
// background evidence at all, and one exit the OS dropped capped a
// multi-day stay at its first 24 hours. A check-in is a confirmed reading of
// where the phone is: inside, the stay so far is folded and restarted at the
// reading (background-math.ts checkpointStay), so each day is credited while
// the person is still there.
//
// Two occasions give us a reading:
//   1. App open: the foreground reporter already took a fix. An inside fix is
//      handed here too, so an open app turns a running stay into full-weight
//      geofence evidence (recordCheckIn).
//   2. A periodic background task, through the OPTIONAL expo-background-task
//      module (WorkManager on Android, BGTaskScheduler on iOS). Absent, the
//      check-in simply does not run; the fence and the app-open check-in
//      still do. The OS decides when a background task actually runs, so this
//      narrows the gap rather than closing it on a schedule.
//
// Readings go through the foreground-service tier's own state machine
// (sampler.ts), on the SAME stored enterAt, so the three sources of truth
// (fence events, service samples, check-ins) cooperate on one stay and never
// count it twice. Only per-day aggregates ever leave the device.
// ---------------------------------------------------------------------------

import * as Location from 'expo-location';
import { armGeofence, geofenceArmed } from './geofence';
import { postObservations } from './post';
import { applyLocationSamples, mergeObservations, type SampleFix } from './sampler';
import { loadPresencePin } from './store';
import {
  loadEnterAt,
  loadFenceUser,
  loadReporterConfig,
  pendingObservations,
  queueObservations,
  replacePending,
  saveEnterAt,
} from './background-store';

export const PRESENCE_CHECKIN_TASK = 'myaza-kyc-presence-checkin';

/** Ask the OS for a check-in about every two hours; it decides the real
 *  cadence. Below the three-hour check-in interval on purpose, so a run that
 *  arrives on time always has a stay long enough to record. */
const CHECKIN_INTERVAL_MINUTES = 120;
const FIX_TIMEOUT_MS = 20_000;
const LAST_KNOWN_MAX_AGE_MS = 15 * 60 * 1000;

interface BackgroundTaskLike {
  registerTaskAsync(name: string, options?: { minimumInterval?: number }): Promise<void>;
  unregisterTaskAsync(name: string): Promise<void>;
  BackgroundTaskResult?: { Success: number; Failed: number };
}

interface TaskManagerLike {
  defineTask(name: string, fn: (body: { data: unknown; error: unknown }) => unknown): void;
}

function backgroundTask(): BackgroundTaskLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-background-task') as Partial<BackgroundTaskLike>;
    return typeof mod?.registerTaskAsync === 'function' ? (mod as BackgroundTaskLike) : null;
  } catch {
    return null;
  }
}

async function flushQueue(userId: string): Promise<void> {
  const cfg = loadReporterConfig(userId);
  if (!cfg) return;
  const pending = pendingObservations(userId);
  if (pending.length === 0) return;
  const ok = await postObservations(cfg.apiKey, cfg.devUrl, userId, pending);
  if (ok) replacePending(userId, []);
}

/**
 * Apply one confirmed reading to the background tier's stay. A no-op unless
 * the background tier was enabled for this user (its reporter config is
 * what the headless flush needs). Never throws.
 */
export async function recordCheckIn(userId: string, fix: SampleFix): Promise<void> {
  try {
    if (!loadReporterConfig(userId)) return;
    const pin = loadPresencePin(userId);
    if (!pin) return;
    const result = applyLocationSamples(pin, [fix], loadEnterAt(userId));
    saveEnterAt(userId, result.enterAt);
    if (result.observations.length > 0) {
      queueObservations(userId, result.observations, mergeObservations);
    }
    await flushQueue(userId);
  } catch {
    // A check-in is best-effort; the fence and the next check-in carry on.
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

async function backgroundFix(): Promise<SampleFix | null> {
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (bg?.status !== 'granted') return null;
  const pos =
    (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), FIX_TIMEOUT_MS)) ??
    (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null));
  if (!pos) return null;
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
    timestamp: pos.timestamp || Date.now(),
    mocked: typeof pos.mocked === 'boolean' ? pos.mocked : null,
  };
}

/** One periodic check-in for the user the fence is armed for. Exported for tests. */
export async function runPeriodicCheckIn(): Promise<boolean> {
  const userId = loadFenceUser();
  if (!userId) return false;
  const pin = loadPresencePin(userId);
  if (!pin) return false;
  const fix = await backgroundFix();
  if (fix) await recordCheckIn(userId, fix);
  // A location toggle drops every fence silently; a check-in is a live
  // process, so it is the moment to put it back.
  if (!(await geofenceArmed())) await armGeofence(userId, pin).catch(() => undefined);
  return fix != null;
}

/** Define the check-in task. Called by registerBackgroundPresence(). */
export function defineCheckInTask(tm: TaskManagerLike): void {
  tm.defineTask(PRESENCE_CHECKIN_TASK, async () => {
    const bt = backgroundTask();
    const ok = await runPeriodicCheckIn().catch(() => false);
    return ok ? bt?.BackgroundTaskResult?.Success ?? 1 : bt?.BackgroundTaskResult?.Failed ?? 2;
  });
}

/** Schedule periodic check-ins. False when expo-background-task is absent. */
export async function scheduleCheckIns(): Promise<boolean> {
  const bt = backgroundTask();
  if (!bt) return false;
  try {
    await bt.registerTaskAsync(PRESENCE_CHECKIN_TASK, { minimumInterval: CHECKIN_INTERVAL_MINUTES });
    return true;
  } catch {
    return false;
  }
}

/** Stop periodic check-ins. Never throws. */
export async function cancelCheckIns(): Promise<void> {
  try {
    await backgroundTask()?.unregisterTaskAsync(PRESENCE_CHECKIN_TASK);
  } catch {
    // Not scheduled, or the module is absent.
  }
}
