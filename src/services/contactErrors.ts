import { KYCApiError } from './api';

// ---------------------------------------------------------------------------
// User-facing copy for the contact-verification send/check failures.
//
// Each message says what happened AND what to do next, because every one of
// these is recoverable and the user is mid-flow. A bare "something went wrong"
// on an expired code leaves them retyping the same dead digits.
// ---------------------------------------------------------------------------

const CHECK_ERRORS: Record<string, string> = {
  invalid_code: 'That code is not correct. Please try again.',
  challenge_expired: 'This code has expired. Request a new one.',
  too_many_attempts: 'Too many incorrect attempts. Request a new code.',
  challenge_not_found: 'This code is no longer valid. Request a new one.',
};

const SEND_ERRORS: Record<string, string> = {
  invalid_destination: 'That does not look valid. Please check and try again.',
  send_rate_limited: 'Too many codes requested. Please wait a while and try again.',
  send_failed: 'We could not send the code. Please try again.',
};

function describe(err: unknown, map: Record<string, string>): string {
  if (err instanceof KYCApiError && err.code && map[err.code]) return map[err.code]!;
  if (err instanceof TypeError) return 'Network error. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

export const describeSendError = (err: unknown): string => describe(err, SEND_ERRORS);
export const describeCheckError = (err: unknown): string => describe(err, CHECK_ERRORS);

/**
 * Attempts left after a wrong code, when the server reports it.
 *
 * Showing the count is what stops a user burning the whole budget guessing —
 * absent it they have no signal that the code is about to die.
 */
export function attemptsRemaining(err: unknown): number | undefined {
  if (!(err instanceof KYCApiError)) return undefined;
  const value = err.body?.attemptsRemaining;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
