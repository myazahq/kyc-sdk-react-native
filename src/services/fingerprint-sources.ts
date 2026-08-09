import { OS } from '../utils/platform';

import type { FingerprintComponents } from './fingerprint';

// ---------------------------------------------------------------------------
// Where each fingerprint component comes from.
//
// Split from fingerprint.ts (200-line rule). Every accessor is guarded: a host
// app missing one of these Expo modules must lose that ONE signal, not the
// whole fingerprint and certainly not the submission.
// ---------------------------------------------------------------------------

/**
 * Runs a literal `require(...)`, returning undefined if it throws.
 *
 * Metro needs a STRING LITERAL module name, so each caller passes its own
 * loader. Under the Node test runner the native modules do not resolve and the
 * loader throws — caught here, which is what lets these tests run at all.
 */
export function tryRequire<T>(loader: () => T): T | undefined {
  try {
    return loader();
  } catch {
    return undefined;
  }
}

interface ExpoDeviceModule {
  brand?: string | null;
  manufacturer?: string | null;
  modelName?: string | null;
  isDevice?: boolean;
  osVersion?: string | null;
  osBuildId?: string | null;
  totalMemory?: number | null;
  supportedCpuArchitectures?: string[] | null;
}

interface ExpoApplicationModule {
  getIosIdForVendorAsync?: () => Promise<string | null>;
  getAndroidId?: () => string | null;
}

interface ExpoLocalizationModule {
  getLocales?: () => Array<{ languageTag?: string }>;
}

/**
 * React Native's own APIs, behind the same guarded require the rest of the SDK's
 * pure modules use (see utils/platform.ts).
 *
 * A static `import … from 'react-native'` here would pull the whole RN module
 * graph into the STORE's import chain, which the plain-Node test runner cannot
 * parse — taking the flow-navigation tests down with it. This is the only
 * reason the fingerprint reaches RN indirectly.
 */
interface ReactNativeApis {
  Dimensions?: { get: (dim: string) => { width: number; height: number } };
  PixelRatio?: { get: () => number; getFontScale: () => number };
  Platform?: { Version?: string | number };
}

export function reactNative(): ReactNativeApis | undefined {
  return tryRequire<ReactNativeApis>(() => require('react-native'));
}

/** `Platform.Version` is a string on iOS and a number (API level) on Android. */
export function platformVersion(): string | undefined {
  const version = reactNative()?.Platform?.Version;
  if (version === undefined || version === null) return undefined;
  const text = String(version);
  return text === '' ? undefined : text;
}

export function safeTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function safeLanguages(): string[] | undefined {
  const localization = tryRequire<ExpoLocalizationModule>(() => require('expo-localization'));
  try {
    const tags = localization?.getLocales?.()
      .map((l) => l.languageTag)
      .filter((tag): tag is string => typeof tag === 'string' && tag !== '');
    return tags && tags.length > 0 ? tags : undefined;
  } catch {
    return undefined;
  }
}

export function safeScreen(): FingerprintComponents['screen'] {
  try {
    const rn = reactNative();
    if (!rn?.Dimensions || !rn.PixelRatio) return undefined;
    const { width, height } = rn.Dimensions.get('screen');
    // Rounded because RN reports fractional logical pixels on some devices, and
    // a hash that changes with a rounding wobble is not an identifier.
    return {
      width: Math.round(width),
      height: Math.round(height),
      scale: rn.PixelRatio.get(),
      fontScale: rn.PixelRatio.getFontScale(),
    };
  } catch {
    return undefined;
  }
}

/** The OS-vended per-install id. Async because iOS's is. */
export async function persistentDeviceId(): Promise<string | undefined> {
  const application = tryRequire<ExpoApplicationModule>(() => require('expo-application'));
  if (!application) return undefined;
  try {
    if (OS === 'ios') return (await application.getIosIdForVendorAsync?.()) ?? undefined;
    if (OS === 'android') return application.getAndroidId?.() ?? undefined;
  } catch {
    /* the OS declined — the fingerprint still works without it */
  }
  return undefined;
}

/** expo-device, or undefined when it is not installed. */
export function expoDevice(): ExpoDeviceModule | undefined {
  return tryRequire<ExpoDeviceModule>(() => require('expo-device'));
}
