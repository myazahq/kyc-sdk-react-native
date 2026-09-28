import { NativeModules, Platform } from 'react-native';

import type { BrightnessBackend } from '../lib/brightness-booster';

// ---------------------------------------------------------------------------
// Where the brightness actually changes, per platform.
//
// ANDROID: the SDK's own native module (MyazaStatusBarModule, already shipped
// for the status bar) sets `screenBrightness` on the window the SDK is drawn
// in, which is the RN <Modal>'s Dialog window, not the host's activity. That
// is a per-window override: no WRITE_SETTINGS permission, the system setting
// is never touched, it stops applying the moment the app leaves the
// foreground, and it dies with the modal. Restoring clears the override
// (BRIGHTNESS_OVERRIDE_NONE); the window is the SDK's own, so there is no
// earlier value of anyone else's to put back. Nothing to install.
//
// iOS: there is no per-window brightness. `UIScreen.brightness` is the one
// knob (it reverts by itself when the device locks), reached through
// `expo-brightness`, a dependency of this SDK, so hosts install nothing. The
// previous value is read first and written back on the way out. If the
// module still fails to load (a host that has not rebuilt its native app
// since upgrading), the theme still turns light and nothing throws; the
// screen simply keeps its brightness. The package's Expo config plugin must
// NOT be added: it declares WRITE_SETTINGS, which this never uses. Shipping
// the package adds no permission, since its own Android manifest is empty and
// Expo only runs a config plugin a host lists in app.json.
// ---------------------------------------------------------------------------

interface StatusBarModuleShape {
  setWindowBrightness?: (viewTag: number, brightness: number) => void;
}

interface ExpoBrightnessShape {
  getBrightnessAsync?: () => Promise<number>;
  setBrightnessAsync?: (value: number) => Promise<void>;
}

let expoBrightness: ExpoBrightnessShape | null | undefined;

function loadExpoBrightness(): ExpoBrightnessShape | null {
  if (expoBrightness === undefined) {
    // The require sits LEXICALLY inside a try, so a native module missing
    // from a stale build degrades to "no brightness" instead of crashing the
    // flow. Typed structurally: only the two calls below are used.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      expoBrightness = require('expo-brightness') as ExpoBrightnessShape;
    } catch {
      expoBrightness = null;
    }
  }
  return expoBrightness;
}

/**
 * The backend for this platform, or null when there is none on this install.
 *
 * @param anchorTag the React tag of a view drawn inside the SDK's modal (read
 *   at call time, since the view mounts after the booster is created). Android
 *   resolves the window from it.
 */
export function loadBrightnessBackend(anchorTag: () => number | null): BrightnessBackend | null {
  if (Platform.OS === 'android') {
    const mod = NativeModules.MyazaStatusBarModule as StatusBarModuleShape | undefined;
    const set = mod?.setWindowBrightness;
    if (!set) return null;
    const onWindow = async (value: number): Promise<void> => {
      const tag = anchorTag();
      if (tag != null) set(tag, value);
    };
    return {
      apply: () => onWindow(1),
      // Negative clears the override: the window follows the system again.
      revert: () => onWindow(-1),
    };
  }

  if (Platform.OS === 'ios') {
    const eb = loadExpoBrightness();
    const get = eb?.getBrightnessAsync;
    const set = eb?.setBrightnessAsync;
    if (!get || !set) return null;
    return {
      read: () => get(),
      apply: () => set(1),
      revert: async (previous) => {
        if (previous != null) await set(previous);
      },
    };
  }

  return null;
}
