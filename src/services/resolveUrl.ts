// ---------------------------------------------------------------------------
// Automatic environment detection from the API key prefix
//
// The environment is encoded in the key prefix — the single source of truth
// (there is no manual environment option). The prefix carries scope
// (`pk` publishable / `sk` secret) and environment (`dev`/`test`/`live`); we
// read ONLY the environment portion, so detection works for both key types.
// Mirrors the web SDK's `resolve-url.ts` and the Flutter SDK's `resolve_url.dart`:
//
//   pk_dev_…  / sk_dev_…   → development
//   pk_test_… / sk_test_…  → sandbox
//   pk_live_… / sk_live_…  → production
// ---------------------------------------------------------------------------

import { isAndroid } from '../utils/platform';

/** Internal environment the SDK resolves a base URL for. Not a public option. */
export type SdkEnvironment = 'development' | 'sandbox' | 'production';

/** Canonical base URLs for the non-development environments. */
const BASE_URLS: Record<Exclude<SdkEnvironment, 'development'>, string> = {
  sandbox: 'https://sandbox.identity.myaza.app',
  production: 'https://identity.myaza.app',
};

/**
 * Default base URL used for development keys when no `devUrl` is provided.
 * Android emulators reach the host machine via `10.0.2.2`; everywhere else
 * (iOS simulator, desktop) `localhost` works directly.
 */
function defaultDevUrl(): string {
  return isAndroid ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
}

// Matches the environment slot of a Myaza API key prefix, regardless of the
// pk_/sk_ scope.
const KEY_ENV_RE = /^(?:pk|sk)_(dev|test|live)_/;

const ENV_BY_PREFIX: Record<'dev' | 'test' | 'live', SdkEnvironment> = {
  dev: 'development',
  test: 'sandbox',
  live: 'production',
};

/**
 * Derives the environment from the API key prefix. Throws a clear error on an
 * unrecognized / malformed key — never silently defaults (defaulting to
 * production would be dangerous).
 */
export function detectEnvironment(apiKey: string): SdkEnvironment {
  const match = typeof apiKey === 'string' ? apiKey.match(KEY_ENV_RE) : null;
  if (!match) {
    throw new Error(
      'Invalid Myaza API key: expected a dev, test, or live key prefix ' +
        '(e.g. pk_dev_…, pk_test_…, or pk_live_…).',
    );
  }
  return ENV_BY_PREFIX[match[1] as 'dev' | 'test' | 'live'];
}

/**
 * Resolves the API base URL from the API key. The environment is detected from
 * the key prefix:
 * - development → `devUrl` if provided, otherwise a platform-aware localhost.
 * - sandbox / production → the hardcoded URL (`devUrl` is ignored).
 *
 * Throws on an invalid key (via {@link detectEnvironment}).
 */
export function resolveBaseUrl(apiKey: string, devUrl?: string): string {
  const environment = detectEnvironment(apiKey);
  if (environment === 'development') {
    return devUrl ?? defaultDevUrl();
  }
  return BASE_URLS[environment];
}

// Hosts that mean "this machine" but resolve differently per platform — a local
// dev server reachable as `localhost` on the iOS sim and `10.0.2.2` on the
// Android emulator.
const LOCAL_HOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i;

/**
 * Normalizes a server-provided absolute asset URL (e.g. the branding logo) for
 * local development. The dev server often returns a hardcoded `localhost` origin,
 * which the Android emulator can't reach. When the SDK is pointed at a local dev
 * server (an `http://` base) and the asset points at a localhost-family host, its
 * origin is rewritten to the SDK's base origin so it loads on every platform.
 *
 * Production / sandbox URLs (`https://`) and assets on any other host (e.g. a
 * public CDN) are returned untouched.
 */
export function normalizeDevAssetUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url) return url;
  // Only ever rewrite for a local (http) dev base — never production CDNs.
  if (!baseUrl.startsWith('http://')) return url;
  if (!LOCAL_HOST_RE.test(url)) return url;
  return url.replace(LOCAL_HOST_RE, baseUrl.replace(/\/+$/, ''));
}
