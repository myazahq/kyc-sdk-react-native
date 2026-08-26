// ---------------------------------------------------------------------------
// mapToKycError — turn a raw network/API error into a typed KYCError
//
// Used at every server call site (upload, verify) so the `onError` callback
// always receives a documented, typed `code`. Mirrors the web SDK's
// `lib/errors.ts` and the Flutter SDK's `kyc_error_mapper.dart` so all
// platforms surface the same codes.
// ---------------------------------------------------------------------------

import { KYCApiError } from './api';
import { KYCError, type KYCErrorCode } from '../types/verification';

/** Which operation failed — picks the fallback code for non-HTTP failures. */
export type ErrorContext = 'upload' | 'verify';

/**
 * Invokes the consumer's `onError` handler defensively — a handler that throws
 * must never crash the SDK flow. Swallows the throw and warns instead.
 */
export function safeReportError(
  onError: ((error: KYCError) => void) | undefined,
  error: KYCError,
): void {
  if (!onError) return;
  try {
    onError(error);
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[MyazaKYC] onError handler threw and was ignored:', err);
    }
  }
}

function toNum(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

/**
 * Maps an unknown error thrown by the API client to a typed {@link KYCError}
 * with a user-facing message. `context` selects the fallback code when the
 * failure isn't a specific HTTP status (a bare network failure during an upload
 * becomes `upload_failed`, during verify becomes `network_error`).
 */
export function mapToKycError(err: unknown, context: ErrorContext): KYCError {
  if (err instanceof KYCApiError) {
    if (err.statusCode === 401) {
      return new KYCError('invalid_api_key', 'Invalid API key. Please contact support.');
    }
    if (err.statusCode === 402) {
      const body = err.body ?? {};
      const required = toNum(body.required);
      const balance = toNum(body.balance);
      const currency = typeof body.currency === 'string' ? body.currency : undefined;
      const message =
        required !== undefined && balance !== undefined
          ? `Insufficient credits. Required: $${required.toFixed(2)}, Available: $${balance.toFixed(2)}`
          : 'Insufficient credits to process this verification.';
      return new KYCError('insufficient_credits', message, { required, balance, currency });
    }
    if (err.statusCode === 403) {
      const feature = typeof err.body?.feature === 'string' ? err.body.feature : null;
      const message =
        err.code === 'id_type_not_allowed'
          ? "This ID type isn't enabled for your organization. Contact your administrator to request access."
          : feature === 'document_verification'
            ? 'Document verification is currently disabled for your organization.'
            : feature === 'gov_db_check'
              ? 'Government database verification is currently disabled for your organization.'
              : err.message || 'This verification feature is currently disabled for your organization.';
      return new KYCError('feature_disabled', message);
    }
    // Nothing came back at all — DNS, routing, a refused connection. Kept
    // SEPARATE from a 5xx: telling somebody the server errored when their
    // request never arrived sends them looking through server logs for a
    // request that was never made.
    if (err.statusCode === 0) {
      const code: KYCErrorCode = context === 'upload' ? 'upload_failed' : 'network_error';
      return new KYCError(code, "Couldn't reach the server. Check your connection and try again.");
    }
    if (err.statusCode >= 500) {
      // Transient server error that survived retries — the request DID arrive.
      const code: KYCErrorCode = context === 'upload' ? 'upload_failed' : 'network_error';
      return new KYCError(code, 'A server error occurred. Please try again in a moment.');
    }
    // Other 4xx — pass the server message through under the context's code.
    const code: KYCErrorCode = context === 'upload' ? 'upload_failed' : 'unknown';
    return new KYCError(code, err.message);
  }
  // fetch() throws a TypeError on network failure (offline / DNS).
  if (err instanceof TypeError) {
    return new KYCError('network_error', 'Network error. Please check your connection and try again.');
  }
  const code: KYCErrorCode = context === 'upload' ? 'upload_failed' : 'unknown';
  return new KYCError(code, err instanceof Error ? err.message : 'Something went wrong. Please try again.');
}
