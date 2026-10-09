// Whether an OPTIONAL Expo package's native half is in this app build.
//
// The SDK loads optional packages with `require()` inside try/catch, which
// covers a package that is not installed at all. It does not cover a package
// whose JavaScript is installed while its native module is not in the build (a
// monorepo that hoists it, or a host that added the package and has not
// rebuilt). That package throws while it initialises, and in a release build
// Metro reports a module that throws during initialisation as a FATAL error
// before any catch runs: the app closes. Found on both phones on 2026-10-05,
// when switching background presence on loaded `expo-background-task` in an
// app built without it.
//
// So ask first, without loading the package: Expo's own lookup returns null
// for a native module that is absent and never throws.

type Lookup = (name: string) => unknown;

function expoLookup(): Lookup | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expo = require('expo') as { requireOptionalNativeModule?: Lookup };
    return typeof expo?.requireOptionalNativeModule === 'function'
      ? expo.requireOptionalNativeModule
      : null;
  } catch {
    return null;
  }
}

/**
 * False only when Expo positively says the native module is absent. When the
 * lookup itself is unavailable (no Expo runtime, as in unit tests) the answer
 * is true, and the caller's own try/catch is what guards the load, as before.
 */
export function nativeModulePresent(name: string, lookup: Lookup | null = expoLookup()): boolean {
  if (!lookup) return true;
  try {
    return lookup(name) != null;
  } catch {
    return false;
  }
}
