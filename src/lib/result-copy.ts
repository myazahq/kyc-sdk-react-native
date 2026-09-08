import type { VerificationOutcome } from './result-wait';
import type { BiometricCopyText } from '../config/biometricOptions';

// ─── What the terminal screens say ──────────────────────────────────────────
//
// Pure so it is testable without React. The server's own reason wins on a
// decline or an error when it sent one: it is written for the applicant.
// UK English, no em dashes (user-facing copy rule).

export type ResultTone = 'success' | 'error' | 'info';

export interface ResultCopy {
  tone: ResultTone;
  title: string;
  description: string;
}

export interface WaitingCopy {
  title: string;
  description: string;
}

/**
 * The ONE loading screen after the capture. On a re-authentication that waits
 * for its verdict it spans the selfie upload, the submission and the poll, so
 * it names the check rather than any of the three steps behind it. A retry in
 * flight replaces the description, never the title: the person is still
 * waiting for the same thing. `override` is the org's own words for the
 * screen (lib/biometric-copy.ts), field by field over the default.
 */
export function describeWaiting(opts: {
  scope: string | null;
  waitsForResult: boolean;
  retry?: { attempt: number; total: number } | null;
  override?: BiometricCopyText | null;
}): WaitingCopy {
  const base = withOverride(waitingCopyFor(opts.scope, opts.waitsForResult), opts.override);
  if (opts.retry) {
    return { title: base.title, description: `Connection issue, retrying (${opts.retry.attempt}/${opts.retry.total}).` };
  }
  return base;
}

function waitingCopyFor(scope: string | null, waitsForResult: boolean): WaitingCopy {
  if (scope === 'biometric-authentication') {
    return waitsForResult
      ? { title: "Checking it's you", description: 'Matching your selfie against the photo on record. This usually takes a few seconds.' }
      : { title: 'Sending your face check', description: 'This only takes a moment.' };
  }
  if (scope === 'biometric-enrollment') {
    return { title: 'Saving your selfie', description: 'It becomes the reference for your future face checks.' };
  }
  return { title: 'Submitting your verification', description: 'Please wait a moment.' };
}

/** The org's own words for a screen, over the default, field by field. */
function withOverride<T extends { title: string; description: string }>(base: T, override?: BiometricCopyText | null): T {
  if (!override) return base;
  return {
    ...base,
    ...(override.title ? { title: override.title } : {}),
    ...(override.description ? { description: override.description } : {}),
  };
}

/** What the person is told, per outcome. The server's own reason wins on a
 *  decline or an error when it sent one; it is written for the applicant.
 *  `copy` is the org's own words for the two verdict screens: on a decline
 *  its description wins even over the server's reason, since the org chose
 *  to say that. */
export function describeOutcome(
  outcome: VerificationOutcome,
  copy?: { verified?: BiometricCopyText | null; declined?: BiometricCopyText | null },
): ResultCopy {
  if (outcome.kind === 'timeout') {
    return {
      tone: 'info',
      title: 'Still checking',
      description: "This is taking longer than usual. You'll be notified as soon as it's done.",
    };
  }
  switch (outcome.status) {
    case 'approved':
      return withOverride(
        { tone: 'success', title: "You're verified", description: 'Your face matched the photo on record.' },
        copy?.verified,
      );
    case 'declined':
      return withOverride(
        {
          tone: 'error',
          title: "We couldn't confirm it's you",
          description: outcome.reason ?? "Your face didn't match the photo on record.",
        },
        copy?.declined,
      );
    case 'in_review':
      return {
        tone: 'info',
        title: 'Under review',
        description: "A reviewer will take a look. You'll be notified of the outcome.",
      };
    case 'error':
      return {
        tone: 'error',
        title: 'Something went wrong',
        description: outcome.reason ?? "We couldn't complete your check. Please try again in a moment.",
      };
    default:
      return {
        tone: 'info',
        title: 'Check submitted',
        description: "You'll be notified of the result.",
      };
  }
}
