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
  // Sandbox and production share the same host; the key prefix selects the env.
  sandbox: 'https://trust.myaza.app',
  production: 'https://trust.myaza.app',
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
  const base = baseUrl.replace(/\/+$/, '');
  if (LOCAL_HOST_RE.test(url)) return url.replace(LOCAL_HOST_RE, base);
  // The server's own branding images, whatever host its PUBLIC_SERVER_URL
  // names: a LAN address the phone cannot reach over a USB tunnel, or one
  // that changed when the Mac rejoined a network. They are served by the
  // SAME server the SDK talks to, so moving them onto its base makes them
  // load (the Flutter SDK's rebaseServerAssets does the same).
  const path = serverBrandingPath(url);
  return path ? `${base}${path}` : url;
}

const SERVER_BRANDING_PATH = '/api/kyc/branding/';

/** The path and query of a server branding URL, or null for any other URL. */
function serverBrandingPath(url: string): string | null {
  const match = /^https?:\/\/[^/]+(\/[^#]*)/i.exec(url);
  const rest = match?.[1];
  return rest && rest.startsWith(SERVER_BRANDING_PATH) ? rest : null;
}

/**
 * A workflow's own logos (`appearance.logo` and the dark theme's) made
 * reachable in local development, as {@link normalizeBrandingUrls} does for
 * the organisation's branding. Workflow responses never went through either.
 */
export function normalizeAppearanceUrls<C>(config: C, baseUrl: string): C {
  const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const appearance = isRecord(config) ? config.appearance : undefined;
  if (!isRecord(appearance)) return config;
  const next: Record<string, unknown> = { ...appearance };
  if (typeof appearance.logo === 'string') next.logo = normalizeDevAssetUrl(appearance.logo, baseUrl);
  const dark = appearance.dark;
  if (isRecord(dark) && typeof dark.logo === 'string') {
    next.dark = { ...dark, logo: normalizeDevAssetUrl(dark.logo, baseUrl) };
  }
  return { ...config, appearance: next };
}

/**
 * The branding's asset URLs made reachable in local development (see
 * normalizeDevAssetUrl): the org logo and a custom footer attribution's logos.
 */
export function normalizeBrandingUrls<
  B extends { logo?: string; trustAttribution?: { mode: string; logo?: string; logoDark?: string } },
>(branding: B | undefined, baseUrl: string): B | undefined {
  if (!branding) return branding;
  const attribution = branding.trustAttribution;
  return {
    ...branding,
    logo: normalizeDevAssetUrl(branding.logo, baseUrl),
    ...(attribution?.mode === 'custom'
      ? {
          trustAttribution: {
            ...attribution,
            logo: normalizeDevAssetUrl(attribution.logo, baseUrl),
            logoDark: normalizeDevAssetUrl(attribution.logoDark, baseUrl),
          },
        }
      : {}),
  };
}
