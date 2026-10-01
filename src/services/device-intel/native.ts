import type { MyazaDeviceIntel } from '../../specs/MyazaDeviceIntel.nitro';
import { tryRequire } from '../fingerprint-sources';

// ---------------------------------------------------------------------------
// Resolving the native Device Intelligence module (ios/HybridMyazaDeviceIntel
// .swift, android/.../HybridMyazaDeviceIntel.kt).
//
// Lazy and re-tried, for the reason emrtd/native.ts gives: a module created at
// load time can evaluate before Nitro's registry is populated and stay null for
// the session. And reached through a GUARDED require rather than a static
// import, so this file — and the fingerprint that depends on it — still loads
// under the plain-Node test runner, where Nitro does not exist. A build without
// the SDK's native code lands in the same place: every signal is omitted.
// ---------------------------------------------------------------------------

interface NitroModulesApi {
  hasHybridObject(name: string): boolean;
  createHybridObject<T>(name: string): T;
}

let cached: MyazaDeviceIntel | null = null;

/** Test seam: inject a fake native module (or null to reset). */
export function setDeviceIntelNativeForTests(mod: MyazaDeviceIntel | null): void {
  cached = mod;
}

export function deviceIntelNative(): MyazaDeviceIntel | null {
  if (cached) return cached;
  const nitro = tryRequire<{ NitroModules?: NitroModulesApi }>(() =>
    require('react-native-nitro-modules'),
  )?.NitroModules;
  if (!nitro) return null;
  try {
    if (!nitro.hasHybridObject('MyazaDeviceIntel')) return null;
    cached = nitro.createHybridObject<MyazaDeviceIntel>('MyazaDeviceIntel');
    return cached;
  } catch {
    return null;
  }
}

/**
 * Races `work` against a deadline, resolving undefined on timeout or failure.
 * Native calls cannot be cancelled, so a late answer is simply ignored.
 */
export function withDeadline<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}
