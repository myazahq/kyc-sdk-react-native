// ---------------------------------------------------------------------------
// Submission callback payload (returned to onSubmit)
// ---------------------------------------------------------------------------

/**
 * The verdict a flow that waited for it hands to `onResult`: the same state
 * vocabulary `GET /api/v1/status/:id` serves, plus the reason pair. No result
 * data (scores, biodata) ever rides here; that stays behind the secret key.
 */
export interface VerificationResult {
  verificationId: string;
  status: import('../services/api-types').SessionStatus;
  reason: string | null;
  reasonCode: string | null;
}

export interface VerificationSubmission {
  verificationId: string;
  status: 'processing';
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
 * - `upload_failed`            — `POST /api/v1/upload` failed (after retries)
 * - `camera_permission_denied` — the user denied (or the OS blocks) camera
 *                                access; capture cannot proceed
 * - `feature_disabled`         — server returned 403 (ID type or a verification
 *                                feature is not enabled for the org)
 * - `unknown`                  — anything else
 *
 * > Voice guidance is text-to-speech *output* — it never records audio, so
 * > there is no microphone-permission error code.
 */
export type VerificationErrorCode =
  | 'network_error'
  | 'invalid_api_key'
  // A `workflowId` that is unknown, unpublished, archived, or belongs to
  // another org/environment. Blocking — the flow never mounts.
  | 'invalid_workflow'
  // The props are unusable as given (e.g. no `country` and no `workflowId`).
  | 'invalid_config'
  | 'insufficient_credits'
  | 'upload_failed'
  | 'camera_permission_denied'
  | 'feature_disabled'
  // The organisation (or Myaza support) cancelled this verification session.
  // Terminal until an admin uncancels it: retrying cannot succeed.
  | 'session_cancelled'
  | 'unknown';

export interface VerificationErrorDetails {
  required?: number;
  balance?: number;
  currency?: string;
}

/**
 * The error instance passed to `onError`. It is a real `Error` (so existing
 * `onError: (error: Error) => void` handlers keep working) that additionally
 * carries a typed `code` and optional `details`. Narrow with `instanceof
 * VerificationError` (or read `error.code`) to branch on the category.
 */
export class VerificationError extends Error {
  readonly code: VerificationErrorCode;
  readonly details?: VerificationErrorDetails;

  constructor(code: VerificationErrorCode, message: string, details?: VerificationErrorDetails) {
    super(message);
    this.name = 'KYCError'; // the earlier name, kept: callers may match on it;
    this.code = code;
    this.details = details;
    // Restore the prototype chain for `instanceof` after transpilation.
    Object.setPrototypeOf(this, VerificationError.prototype);
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
