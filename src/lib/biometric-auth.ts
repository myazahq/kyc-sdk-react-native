import { KYCApiError } from '../services/api';
import { KYCError } from '../types/verification';
import type { BiometricAuthResponse } from '../services/api-types-biometric';

// ---------------------------------------------------------------------------
// Biometric re-authentication — the pure half. Mirrors the web SDK's
// MyazaBiometricAuth error mapping and outcome shapes (keep in lockstep).
// ---------------------------------------------------------------------------

export type BiometricAuthOutcome =
  | { kind: 'success'; result: BiometricAuthResponse }
  | { kind: 'failed'; result: BiometricAuthResponse }
  | { kind: 'error'; message: string };

export interface BiometricAuthenticated {
  attemptId: string;
  confidence: number | null;
  /** Single-use proof; verify from your backend at `/biometric/verify-proof`. */
  token?: string;
}

export interface BiometricAuthFailed {
  status: BiometricAuthResponse['status'];
  attemptId: string;
  confidence: number | null;
}

/** A technical failure, in the SDK's typed vocabulary + a message a person
 *  can read. Never the server's own wording — that is an internal contract. */
export function mapAuthError(err: unknown): KYCError {
  if (err instanceof KYCApiError) {
    if (err.statusCode === 404 && err.code === 'not_enrolled') {
      return new KYCError('unknown', "You're not set up for face verification yet.");
    }
    if (err.statusCode === 402) {
      return new KYCError('insufficient_credits', 'Face verification is temporarily unavailable.');
    }
    if (err.statusCode === 401 || err.statusCode === 403) {
      return new KYCError('invalid_api_key', 'This app is not authorised for face verification.');
    }
  }
  return new KYCError('network_error', 'Something went wrong. Please try again.');
}

/** The verdict as the callbacks and the result screen read it. */
export function outcomeOf(result: BiometricAuthResponse): BiometricAuthOutcome {
  return result.authenticated ? { kind: 'success', result } : { kind: 'failed', result };
}

export function defaultReauthLabel(companyName?: string): string {
  return companyName ? `Verify it's you with ${companyName}` : "Verify it's you";
}
