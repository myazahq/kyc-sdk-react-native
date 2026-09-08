// ---------------------------------------------------------------------------
// Server-driven config state (GET /api/kyc/config) — mirrors the Flutter SDK's
// serverConfig handling on KYCState. Holds the org's allowed (country, idType)
// list, per-ID feature flags, branding, and an error classification.
// ---------------------------------------------------------------------------

import { KYCApiError } from '../services/api';
import type { SdkConfigBranding, SdkConfigIdType } from '../services/api';

export type ServerConfigStatus = 'loading' | 'ready' | 'error';

export interface IdTypeFeatures {
  documentVerification: boolean;
  livenessCheck: boolean;
  govDbCheck: boolean;
}

export interface ServerConfigState {
  status: ServerConfigStatus;
  idTypes: SdkConfigIdType[];
  branding?: SdkConfigBranding;
  /** The visitor's country from their IP — a default, never evidence. */
  geoCountry?: string | null;
  /**
   * Whether the platform has a forward-search backend, and which one. Absent
   * means the address flow simply has no search screen: the applicant places
   * the pin by hand, which is the fallback every address failure degrades to.
   *
   * The Google KEY itself never rides here (it is the hosted page's alone);
   * the framed picker reaches this SDK as a URL instead — see mapsFrameUrl.
   * Street View entrance framing still does not exist on mobile.
   */
  addressSearch?: boolean;
  addressSearchMode?: 'autocomplete' | 'basic';
  /**
   * The framed Google-map picker page for a WebView (`react-native-webview`,
   * an optional peer): our hosted /embed/map plus a signed APP grant. Null or
   * absent ⇒ the built-in OSM picker, which is also the fallback when the
   * page never reports ready.
   */
  mapsFrameUrl?: string | null;
  environment?: 'DEVELOPMENT' | 'SANDBOX' | 'PRODUCTION';
  /** HTTP status of a failed config fetch (if any). */
  statusCode?: number;
  /** A fatal failure (401/403) blocks the flow; non-fatal falls back to the prop list. */
  fatal: boolean;
  /** User-facing message for a fatal failure. */
  message?: string;
}

export const INITIAL_SERVER_CONFIG: ServerConfigState = {
  status: 'loading',
  idTypes: [],
  fatal: false,
};

/**
 * Returns the per-ID feature flags for a `(country, idType)` pair, or `null`
 * when the ID isn't granted or config hasn't loaded. Mirrors Flutter's
 * `featuresFor` — callers must NOT replicate precedence logic elsewhere.
 */
export function featuresFor(
  config: ServerConfigState,
  country: string,
  idType: string,
): IdTypeFeatures | null {
  if (config.status !== 'ready') return null;
  const match = config.idTypes.find((t) => t.country === country && t.idType === idType);
  return match ? match.features : null;
}

/**
 * Classifies a config-fetch error. 401 (invalid key) and 403 (not permitted) are
 * FATAL — they block the flow and report to onError once. Everything else
 * (network blips, 5xx) is non-fatal — the SDK trusts the consumer's `idTypes`
 * prop and the server still 403s anything actually disabled. Mirrors Flutter's
 * `_describeConfigError`.
 */
export function describeConfigError(err: unknown): Pick<ServerConfigState, 'statusCode' | 'fatal' | 'message'> {
  if (err instanceof KYCApiError) {
    if (err.statusCode === 401) {
      return {
        statusCode: 401,
        fatal: true,
        message: 'Invalid API key. Please contact support.',
      };
    }
    if (err.statusCode === 403) {
      return {
        statusCode: 403,
        fatal: true,
        message: "Your organization isn't permitted to start verification. Contact your administrator.",
      };
    }
    return { statusCode: err.statusCode, fatal: false };
  }
  return { fatal: false };
}
