// ---------------------------------------------------------------------------
// Submission callback payload (returned to onSubmit)
// ---------------------------------------------------------------------------

export interface KYCSubmission {
  verificationId: string;
  status: 'pending';
  metadata: Record<string, string>;
  submittedAt: string;
}

// ---------------------------------------------------------------------------
// Technical error types (onError callback)
// ---------------------------------------------------------------------------

/**
 * Typed, documented technical-error categories surfaced through `onError`.
 * These are IDENTICAL to the web + Flutter SDKs' codes so integrators get one
 * consistent contract across all three platforms.
 *
 * - `network_error`            — connection failure / timeout (after retries)
 * - `invalid_api_key`          — server returned 401
 * - `insufficient_credits`     — server returned 402 (see `details`)
 * - `upload_failed`            — `POST /api/kyc/upload` failed (after retries)
 * - `camera_permission_denied` — the user denied (or the OS blocks) camera
 *                                access; capture cannot proceed
 * - `feature_disabled`         — server returned 403 (ID type or a verification
 *                                feature is not enabled for the org)
 * - `unknown`                  — anything else
 *
 * > Voice guidance is text-to-speech *output* — it never records audio, so
 * > there is no microphone-permission error code.
 */
export type KYCErrorCode =
  | 'network_error'
  | 'invalid_api_key'
  | 'insufficient_credits'
  | 'upload_failed'
  | 'camera_permission_denied'
  | 'feature_disabled'
  | 'unknown';

export interface KYCErrorDetails {
  required?: number;
  balance?: number;
  currency?: string;
}

/**
 * The error instance passed to `onError`. It is a real `Error` (so existing
 * `onError: (error: Error) => void` handlers keep working) that additionally
 * carries a typed `code` and optional `details`. Narrow with `instanceof
 * KYCError` (or read `error.code`) to branch on the category.
 */
export class KYCError extends Error {
  readonly code: KYCErrorCode;
  readonly details?: KYCErrorDetails;

  constructor(code: KYCErrorCode, message: string, details?: KYCErrorDetails) {
    super(message);
    this.name = 'KYCError';
    this.code = code;
    this.details = details;
    // Restore the prototype chain for `instanceof` after transpilation.
    Object.setPrototypeOf(this, KYCError.prototype);
  }
}

// ---------------------------------------------------------------------------
// API call status (used by stores)
// ---------------------------------------------------------------------------

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}
