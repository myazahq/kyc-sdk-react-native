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
