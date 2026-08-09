// Device & SDK metadata collected at verify time. Sent as `metadata.device` in
// the verify payload — the server merges it with server-side facts (real IP,
// X-SDK-Version header) before persisting. Mirrors the web SDK's
// `utils/device-metadata.ts` and the Flutter SDK's `device_metadata_service.dart`.

import { OS } from '../utils/platform';

export const SDK_TYPE = 'react-native' as const;

/** Coarse device class, consistent with the Web/Flutter SDKs' `device.type`. */
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

/**
 * Single source of truth for the SDK version — also used by `services/api.ts`
 * for the `X-SDK-Version` header. Keep in sync with `package.json`.
 */
export const SDK_VERSION = '2.1.0';

export interface ReactNativeDeviceMetadata {
  sdkType: 'react-native';
  sdkVersion: string;
  sdkPlatform: 'ios' | 'android' | 'other';
  capturedAt: string;
  device: {
    /**
     * Coarse device class the dashboard reads first to classify a verification.
     * Matches the Web/Flutter SDKs' `device.type`.
     */
    type: DeviceType;
    /** Device maker (from expo-device's `brand`); the dashboard reads `vendor`. */
    vendor?: string;
    brand?: string;
    manufacturer?: string;
    model?: string;
    isDevice?: boolean;
  };
  os: {
    name: string;
    version?: string;
  };
  app?: {
    version?: string;
    buildVersion?: string;
    bundleId?: string;
  };
  locale?: string;
  timezone?: string;
}

/**
 * Runs a literal `require(...)` loader, returning `undefined` if it throws.
 * Metro needs the module name to be a STRING LITERAL (no `require(variable)`),
 * so each caller passes its own literal loader. Under the Node test runner the
 * native modules aren't resolvable and the loader throws — caught here.
 */
function tryRequire<T>(loader: () => T): T | undefined {
  try {
    return loader();
  } catch {
    return undefined;
  }
}

function sdkPlatform(): ReactNativeDeviceMetadata['sdkPlatform'] {
  if (OS === 'ios') return 'ios';
  if (OS === 'android') return 'android';
  return 'other';
}

/**
 * Clean OS name. expo-device's `osName` is unreliable on Android — on many devices
 * (Samsung, Xiaomi, …) it returns the build FINGERPRINT, e.g.
 * "samsung/e1q:16/BP2A…/S921U1…:user/release-keys", instead of "Android". So derive
 * the name from the platform (matching the Flutter SDK, which hardcodes "Android");
 * iOS reports "iOS"/"iPadOS" reliably, so keep expo-device's value there.
 */
function resolveOsName(device: ExpoDeviceModule | undefined): string {
  if (OS === 'android') return 'Android';
  if (OS === 'ios') return device?.osName ?? 'iOS';
  return device?.osName ?? OS;
}

function safeTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

interface ExpoDeviceModule {
  brand?: string | null;
  manufacturer?: string | null;
  modelName?: string | null;
  isDevice?: boolean;
  osName?: string | null;
  osVersion?: string | null;
  /**
   * expo-device's `DeviceType` enum value (numeric):
   * UNKNOWN=0, PHONE=1, TABLET=2, DESKTOP=3, TV=4. `null` when undeterminable.
   */
  deviceType?: number | null;
}

/**
 * Maps expo-device's numeric `DeviceType` to our coarse class, mirroring the
 * Flutter/Web SDKs (PHONE→mobile, TABLET→tablet, DESKTOP→desktop,
 * TV/UNKNOWN→unknown). When expo-device is unavailable or can't determine a type,
 * falls back to the platform: ios/android → 'mobile', otherwise 'unknown'.
 */
export function inferDeviceType(device: { deviceType?: number | null } | undefined): DeviceType {
  switch (device?.deviceType) {
    case 1:
      return 'mobile'; // PHONE
    case 2:
      return 'tablet'; // TABLET
    case 3:
      return 'desktop'; // DESKTOP
    case 0: // UNKNOWN
    case 4: // TV
      return 'unknown';
    default:
      // expo-device unavailable / deviceType null — use the platform.
      return OS === 'ios' || OS === 'android' ? 'mobile' : 'unknown';
  }
}

interface ExpoApplicationModule {
  nativeApplicationVersion?: string | null;
  nativeBuildVersion?: string | null;
  applicationId?: string | null;
}

interface ExpoLocalizationModule {
  getLocales?: () => Array<{ languageTag?: string }>;
}

/**
 * Collects best-effort device metadata. Every field degrades gracefully — if
 * `expo-device` / `expo-application` / `expo-localization` aren't installed (or
 * under a Node test runner), the relevant fields are simply omitted.
 */
export function collectDeviceMetadata(): ReactNativeDeviceMetadata {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const device = tryRequire<ExpoDeviceModule>(() => require('expo-device'));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const application = tryRequire<ExpoApplicationModule>(() => require('expo-application'));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const localization = tryRequire<ExpoLocalizationModule>(() => require('expo-localization'));

  const meta: ReactNativeDeviceMetadata = {
    sdkType: SDK_TYPE,
    sdkVersion: SDK_VERSION,
    sdkPlatform: sdkPlatform(),
    capturedAt: new Date().toISOString(),
    device: {
      type: inferDeviceType(device),
      vendor: device?.brand ?? undefined,
      brand: device?.brand ?? undefined,
      manufacturer: device?.manufacturer ?? undefined,
      model: device?.modelName ?? undefined,
      isDevice: device?.isDevice,
    },
    os: {
      name: resolveOsName(device),
      version: device?.osVersion ?? undefined,
    },
    timezone: safeTimezone(),
  };

  if (application) {
    meta.app = {
      version: application.nativeApplicationVersion ?? undefined,
      buildVersion: application.nativeBuildVersion ?? undefined,
      bundleId: application.applicationId ?? undefined,
    };
  }

  const locales = localization?.getLocales?.();
  if (locales && locales.length > 0) {
    meta.locale = locales[0]?.languageTag;
  }

  return meta;
}
