// Thin wrapper around React Native's `Platform` so the SDK's pure-logic modules
// (resolveUrl, deviceMetadata) stay testable under a plain Node test runner —
// where the `react-native` module isn't resolvable. Under Metro/RN this reads
// the real `Platform.OS`; under Node it falls back to `'ios'`.
//
// This is the ONLY place the SDK reaches for `Platform` outside of React
// components, so the platform concern is isolated to a single file.

export type PlatformOS = 'ios' | 'android' | 'windows' | 'macos' | 'web';

function readOS(): PlatformOS {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native') as { Platform?: { OS?: PlatformOS } };
    return rn?.Platform?.OS ?? 'ios';
  } catch {
    return 'ios';
  }
}

export const OS: PlatformOS = readOS();
export const isAndroid = OS === 'android';
export const isIOS = OS === 'ios';
