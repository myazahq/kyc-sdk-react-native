import { OS } from '../../utils/platform';
import { persistentDeviceId, tryRequire } from '../fingerprint-sources';
import { deviceIntelNative } from './native';

// ---------------------------------------------------------------------------
// The two device identifiers Device Intelligence sends (kyc-core
// docs/DEVICE_INTEL_WIRE.md), and how they differ:
//
//   • deviceId — per INSTALL (iOS identifierForVendor, Android ANDROID_ID).
//     Rides the fingerprint AND every upload's `X-Myaza-Device-Id` header, so
//     the server can tell when one session's captures came from two phones.
//   • stableId — survives a REINSTALL. iOS: a UUID in the Keychain (native,
//     because no Expo module writes a this-device-only Keychain item).
//     Android: ANDROID_ID, which already survives a reinstall on Android 8+.
// ---------------------------------------------------------------------------

/** The contract's caps. Longer values are omitted, never truncated: a cut id
 *  would no longer equal the fingerprint's and would read as a second device. */
export const MAX_DEVICE_ID_LENGTH = 64;
export const MAX_STABLE_ID_LENGTH = 128;

let deviceIdPromise: Promise<string | undefined> | null = null;

/**
 * The per-install id, read once per process. Only a successful read is kept:
 * an OS that declined once (iOS before first unlock) is asked again next time.
 */
export function cachedDeviceId(): Promise<string | undefined> {
  if (!deviceIdPromise) {
    deviceIdPromise = persistentDeviceId()
      .catch(() => undefined)
      .then((id) => {
        if (!id) deviceIdPromise = null;
        return id && id.length <= MAX_DEVICE_ID_LENGTH ? id : undefined;
      });
  }
  return deviceIdPromise;
}

/** Test seam: forget the cached device id. */
export function resetDeviceIdCacheForTests(): void {
  deviceIdPromise = null;
}

interface ExpoApplicationAndroid {
  getAndroidId?: () => string | null;
}

/** The reinstall-proof id, or undefined. Never throws. */
export function collectStableId(): string | undefined {
  let id: string | undefined;
  try {
    if (OS === 'android') {
      // expo-application already reads ANDROID_ID for the fingerprint's
      // deviceId; the native module is only the fallback when it is absent.
      const app = tryRequire<ExpoApplicationAndroid>(() => require('expo-application'));
      id = app?.getAndroidId?.() || deviceIntelNative()?.stableId() || undefined;
    } else if (OS === 'ios') {
      id = deviceIntelNative()?.stableId();
    }
  } catch {
    return undefined;
  }
  return id && id.length <= MAX_STABLE_ID_LENGTH ? id : undefined;
}
