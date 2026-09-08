// ---------------------------------------------------------------------------
// One-shot geolocation for the address-collection step.
//
// Best-effort BY CONTRACT, mirroring the web SDK's address-helpers: a denied
// permission, a device with location off, or a slow fix costs the `attested`
// tier (or the recentre convenience) — never the flow. The attest fix resolves
// to null / {} on any failure; the PIN's fix says WHY it failed, so the copy
// can send the person to the right remedy (see lib/address-current-location).
// ---------------------------------------------------------------------------

import * as Location from 'expo-location';

const FIX_TIMEOUT_MS = 8_000;

/** Accuracy at which a fix is good enough to stop waiting for the GPS. */
const PRECISE_ENOUGH_M = 25;
const PRECISE_WINDOW_MS = 8_000;
/**
 * Once ANY fix exists, wait only this much longer for a better one. An indoor
 * or wifi-derived fix never reaches 25m, and sitting out the whole window for
 * an accuracy that is not coming reads as "it keeps loading".
 */
const FIRST_FIX_GRACE_MS = 3_000;

export interface DeviceFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number;
  /** Android reports a mock-location provider; iOS has no equivalent (null). */
  mocked: boolean | null;
}

/**
 * Why a fix could not be taken. A refused permission, a phone that cannot
 * place itself (location switched off, no provider), and a fix that took
 * longer than the window are three different problems with three different
 * remedies. Mirrors the web SDK's LocationFailure and Flutter's enum.
 */
export type LocationFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export type PreciseFixOutcome = { fix: DeviceFix } | { failure: LocationFailure };

function toFix(pos: Location.LocationObject): DeviceFix {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
    timestamp: pos.timestamp || Date.now(),
    mocked: typeof pos.mocked === 'boolean' ? pos.mocked : null,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('location timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// The most recent fix ANY read produced, kept so the confirm-time attest read
// can fall back on it (see deviceFixFields).
let lastGoodFix: DeviceFix | null = null;
function remember(fix: DeviceFix): DeviceFix {
  lastGoodFix = fix;
  return fix;
}

/** A fix older than this no longer says where the phone is NOW. */
export const LAST_KNOWN_MAX_AGE_MS = 10 * 60_000;

/**
 * One fix for a presence report, or null. Asks for foreground permission on
 * first use.
 *
 * Resolves the way the pin step's precise read learned to, in three rungs:
 * a fresh read at BALANCED accuracy (the fence is 250m or wider, so a 100m
 * fix is plenty; Expo's iOS read waits for a fix that MEETS the requested
 * accuracy, and a High request indoors never delivered one inside the
 * window, so every RN report on the iPhone came back `no_fix` while
 * Flutter's Geolocator, which returns the first update, reported fine,
 * 2026-09-08), then the platform's last known position, then the last fix
 * this module itself took (the pin step's, minutes earlier), each accepted
 * only within LAST_KNOWN_MAX_AGE_MS. Flutter's reporter carries the same
 * last-known fallback.
 */
export async function currentPosition(): Promise<DeviceFix | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
  } catch {
    return null;
  }
  const fresh = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    FIX_TIMEOUT_MS,
  ).then(toFix, () => null);
  if (fresh) return remember(fresh);
  const known = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).then(
    (pos) => (pos ? toFix(pos) : null),
    () => null,
  );
  if (known) return remember(known);
  if (lastGoodFix && Date.now() - lastGoodFix.timestamp <= LAST_KNOWN_MAX_AGE_MS) return lastGoodFix;
  return null;
}

/**
 * A PRECISE fix: watch the position for up to ~8s, keep the most accurate
 * reading, and resolve early once it is within 25m.
 *
 * A single `getCurrentPositionAsync` routinely answers with the first coarse
 * wifi/cell reading — hundreds of metres out, before the GPS has warmed up —
 * which is exactly the pin landing on the wrong compound. A WATCH also never
 * hands back a cached fix, which is the other half of what a pin needs.
 *
 * Never throws: every failure is CLASSIFIED, and every caller falls back to
 * placing the pin by hand.
 */
export async function precisePositionOutcome(): Promise<PreciseFixOutcome> {
  let granted = false;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    granted = status === 'granted';
  } catch {
    // No location module behind the call: nothing on this device can answer.
    return { failure: 'unsupported' };
  }
  if (!granted) return { failure: 'denied' };
  try {
    // Permission granted with the toggle OFF is the failure people hit most,
    // and it is the one "allow location access" sends them the wrong way on.
    if (!(await Location.hasServicesEnabledAsync())) return { failure: 'unavailable' };
  } catch {
    // An older module without the probe: let the watch decide.
  }

  return new Promise<PreciseFixOutcome>((resolve) => {
    let best: Location.LocationObject | null = null;
    let settled = false;
    let watchFailed = false;
    let sub: Location.LocationSubscription | null = null;
    let grace: ReturnType<typeof setTimeout> | null = null;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(windowTimer);
      if (grace) clearTimeout(grace);
      sub?.remove();
      if (best) resolve({ fix: remember(toFix(best)) });
      else resolve({ failure: watchFailed ? 'unavailable' : 'timeout' });
    };

    const windowTimer = setTimeout(finish, PRECISE_WINDOW_MS);

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0 },
      (pos) => {
        const acc = pos.coords.accuracy ?? Infinity;
        if (!best || acc < (best.coords.accuracy ?? Infinity)) best = pos;
        if (acc <= PRECISE_ENOUGH_M) {
          finish();
          return;
        }
        if (!grace) grace = setTimeout(finish, FIRST_FIX_GRACE_MS);
      },
    )
      .then((subscription) => {
        // The window may already have elapsed while the watch was starting —
        // hold no subscription nobody will ever remove.
        if (settled) subscription.remove();
        else sub = subscription;
      })
      .catch(() => {
        watchFailed = true;
        finish();
      });
  });
}

/**
 * The attest-presence device fix, as the fields the verify body carries.
 * Empty when no fix could be taken — the submission simply goes without the
 * `attested` tier.
 */
/** How old a fix from earlier in the SAME address flow may be and still stand
 *  in for the confirm-time read. Placing a pin takes a minute or two; a fix
 *  from that window still says the device was here, and the server judges it
 *  by its own `capturedAt` anyway. */
export const RECENT_FIX_MAX_AGE_MS = 3 * 60_000;

/** The reading the attest step should send: a fresh one when the read
 *  answered, else the recent one the flow already took, else nothing. Pure,
 *  so the rule is testable without a GPS. */
export function pickDeviceFix(
  fresh: DeviceFix | null,
  recent: DeviceFix | null,
  now: number = Date.now(),
): DeviceFix | null {
  if (fresh) return fresh;
  if (recent && now - recent.timestamp <= RECENT_FIX_MAX_AGE_MS && recent.mocked !== true) return recent;
  return null;
}

export async function deviceFixFields(): Promise<{
  deviceLat?: number;
  deviceLng?: number;
  deviceAccuracy?: number;
  capturedAt?: string;
}> {
  // A single getCurrentPositionAsync at confirm routinely times out on iOS
  // while the GPS is still settling, and the submission then went out with
  // no fix at all even though "Use my location" had just placed the pin on
  // one (iPhone 16 Pro Max, 2026-09-07: every address run read "No device
  // fix taken"). The fix the flow already holds is the fallback.
  const fix = pickDeviceFix(await currentPosition(), lastGoodFix);
  if (!fix) return {};
  return {
    deviceLat: fix.lat,
    deviceLng: fix.lng,
    ...(fix.accuracy != null ? { deviceAccuracy: fix.accuracy } : {}),
    capturedAt: new Date(fix.timestamp).toISOString(),
  };
}
