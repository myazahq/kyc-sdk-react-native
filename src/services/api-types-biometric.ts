// ---------------------------------------------------------------------------
// Biometric re-authentication wire shapes — a mirror of the web SDK's
// services/api.ts (keep the two in lockstep). Publishable-safe: the verdict,
// a confidence, and a single-use proof token. No PII.
// ---------------------------------------------------------------------------

/** What the SDK asserts about the liveness run that produced the selfie. */
export interface BiometricLivenessClaim {
  mode: 'gestures' | 'flash' | 'both';
  passed: boolean;
}

/** Request body for `POST /api/kyc/biometric/authenticate`. */
export interface BiometricAuthRequest {
  /** The org's user reference (Entity.externalUserId) being re-authenticated. */
  externalUserId: string;
  /** A mediaId from `upload(file, 'selfie')` — the live selfie. */
  selfie: string;
  liveness?: BiometricLivenessClaim;
}

/**
 * Response from `POST /api/kyc/biometric/authenticate`. `token` is present
 * only on `authenticated` — redeem it from your backend with a secret key at
 * `/biometric/verify-proof`.
 */
export interface BiometricAuthResponse {
  authenticated: boolean;
  status: 'authenticated' | 'no_match' | 'liveness_failed';
  confidence: number | null;
  live: boolean;
  attemptId: string;
  token?: string;
}

/** Response from `GET /api/kyc/biometric/status/:externalUserId`. */
export interface BiometricStatusResponse {
  enrolled: boolean;
  enrolledAt?: string;
  lastAuthenticatedAt?: string | null;
}
