// ---------------------------------------------------------------------------
// The on-device pin store. When a workflow enables presence verification, the
// captured pin is saved LOCALLY (keyed by the org's user reference) so later
// app opens can evaluate "am I at the address?" without the coordinates ever
// leaving the phone. A small JSON file in the app's document directory via
// expo-file-system — loaded through the SDK's optional-module pattern, so a
// host app without the module simply has no presence tier (never a crash).
// ---------------------------------------------------------------------------

import { readJsonFile, writeJsonFile } from './fs';

export interface StoredPin {
  lat: number;
  lng: number;
  savedAt: string;
  /** Always-on monitoring: the pin lives as long as the arrangement does
   *  (cleared only by clearPresencePin — revoke or sign-out), because the
   *  server keeps renewing the watch and reports must keep flowing. */
  alwaysOn?: boolean;
}

const FILE_NAME = 'myaza-kyc-presence.json';

/**
 * How long a stored pin may drive reports. The watch it feeds resolves within
 * its policy window (30 days at the longest) and the server discards reports
 * for a resolved watch anyway — but the DEVICE kept sampling location on
 * every app open forever, for a check that had finished. The server cannot
 * say "stop" without breaking the ingest endpoint's enumeration safety (an
 * unknown user and a resolved watch must answer identically), so the bound
 * lives here: longest window plus resolution slack, then the pin self-expires
 * and the reporter goes quiet before ever touching the GPS.
 */
export const PIN_TTL_DAYS = 45;

export function pinExpired(pin: StoredPin, nowMs: number = Date.now()): boolean {
  // An always-on pin has no end date by design (the OkHi model): monitoring
  // continues until revoked, and the TTL below exists only for BOUNDED
  // watches whose purpose has a deadline.
  if (pin.alwaysOn === true) return false;
  const saved = Date.parse(pin.savedAt);
  // An unparseable stamp is treated as expired: both platforms have always
  // written savedAt, so a missing one is corruption, and corrupt entries must
  // age out rather than report forever.
  if (Number.isNaN(saved)) return true;
  // Strictly past the TTL — the Flutter mirror compares the same way.
  return nowMs - saved > PIN_TTL_DAYS * 24 * 60 * 60 * 1000;
}

function readAll(): Record<string, StoredPin> {
  return readJsonFile(FILE_NAME) as Record<string, StoredPin>;
}

function writeAll(pins: Record<string, StoredPin>): void {
  writeJsonFile(FILE_NAME, pins as Record<string, unknown>);
}

/** Saves the captured pin for later foreground reports. Never throws. */
export function savePresencePin(
  externalUserId: string,
  pin: { lat: number; lng: number },
  opts?: { alwaysOn?: boolean },
): void {
  if (!externalUserId) return;
  const pins = readAll();
  pins[externalUserId] = {
    lat: pin.lat,
    lng: pin.lng,
    savedAt: new Date().toISOString(),
    ...(opts?.alwaysOn === true ? { alwaysOn: true } : {}),
  };
  writeAll(pins);
}

/** The stored pin for a user, or null (no store / never captured here /
 *  aged out — an expired pin is cleared on the way through). */
export function loadPresencePin(externalUserId: string): StoredPin | null {
  const pin = readAll()[externalUserId];
  if (!pin || typeof pin.lat !== 'number' || typeof pin.lng !== 'number') return null;
  if (pinExpired(pin)) {
    clearPresencePin(externalUserId);
    return null;
  }
  return pin;
}

/** Drops a stored pin (e.g. after a watch resolves or the user signs out). */
export function clearPresencePin(externalUserId: string): void {
  const pins = readAll();
  if (externalUserId in pins) {
    delete pins[externalUserId];
    writeAll(pins);
  }
}
