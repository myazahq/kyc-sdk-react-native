import type { VerificationOutcome } from './result-wait';
import type { BiometricCopyText } from '../config/biometricOptions';
import { defaultText } from '../i18n/translate';
import type { TextFn } from '../i18n/types';
import { CANCELLED_TITLE, DEFAULT_CANCELLED_MESSAGE } from './session-cancelled';

// ─── What the terminal screens say ──────────────────────────────────────────
//
// Pure so it is testable without React. The server's own reason wins on a
// decline or an error when it sent one: it is written for the applicant.
// UK English, no em dashes (user-facing copy rule). The words come from the
// text catalogue (i18n/defaults/result.ts) through `t`, and the org's dedicated
// biometric.copy fields ride as the legacy value, so they still win.

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
export function describeWaiting(
  opts: {
    scope: string | null;
    waitsForResult: boolean;
    retry?: { attempt: number; total: number } | null;
    override?: BiometricCopyText | null;
  },
  t: TextFn = defaultText,
): WaitingCopy {
  const keys = waitingKeysFor(opts.scope, opts.waitsForResult);
  const title = t(keys.title, undefined, opts.override?.title);
  if (opts.retry) {
    return { title, description: `Connection issue, retrying (${opts.retry.attempt}/${opts.retry.total}).` };
  }
  return { title, description: t(keys.description, undefined, opts.override?.description) };
}

/** A screen's two catalogue keys, spelt out so every key reads as a literal. */
interface ScreenKeys {
  title: string;
  description: string;
}

const WAITING_KEYS: Record<'checking' | 'sending' | 'saving' | 'submitting', ScreenKeys> = {
  checking: { title: 'result.faceCheck.checking.title', description: 'result.faceCheck.checking.description' },
  sending: { title: 'result.faceCheck.sending.title', description: 'result.faceCheck.sending.description' },
  saving: { title: 'result.faceEnrolment.saving.title', description: 'result.faceEnrolment.saving.description' },
  submitting: { title: 'result.submitting.title', description: 'result.submitting.description' },
};

function waitingKeysFor(scope: string | null, waitsForResult: boolean): ScreenKeys {
  if (scope === 'biometric-authentication') return waitsForResult ? WAITING_KEYS.checking : WAITING_KEYS.sending;
  if (scope === 'biometric-enrollment') return WAITING_KEYS.saving;
  return WAITING_KEYS.submitting;
}

const OUTCOME_KEYS: Record<'verified' | 'declined' | 'inReview' | 'submitted' | 'timeout', ScreenKeys> = {
  verified: { title: 'result.faceCheck.verified.title', description: 'result.faceCheck.verified.description' },
  declined: { title: 'result.faceCheck.declined.title', description: 'result.faceCheck.declined.description' },
  inReview: { title: 'result.faceCheck.inReview.title', description: 'result.faceCheck.inReview.description' },
  submitted: { title: 'result.faceCheck.submitted.title', description: 'result.faceCheck.submitted.description' },
  timeout: { title: 'result.faceCheck.timeout.title', description: 'result.faceCheck.timeout.description' },
};

/** A title and description from the catalogue, the org's words (if any) over each. */
function screen(t: TextFn, keys: ScreenKeys, override?: BiometricCopyText | null): WaitingCopy {
  return {
    title: t(keys.title, undefined, override?.title),
    description: t(keys.description, undefined, override?.description),
  };
}

/** What the person is told, per outcome. The server's own reason wins on a
 *  decline or an error when it sent one; it is written for the applicant.
 *  `copy` is the org's own words for the two verdict screens: on a decline
 *  its description wins even over the server's reason, since the org chose
 *  to say that (as does the workflow's own text for that description). */
export function describeOutcome(
  outcome: VerificationOutcome,
  copy?: { verified?: BiometricCopyText | null; declined?: BiometricCopyText | null },
  t: TextFn = defaultText,
): ResultCopy {
  if (outcome.kind === 'timeout') return { tone: 'info', ...screen(t, OUTCOME_KEYS.timeout) };
  switch (outcome.status) {
    case 'approved':
      return { tone: 'success', ...screen(t, OUTCOME_KEYS.verified, copy?.verified) };
    case 'declined': {
      const words = screen(t, OUTCOME_KEYS.declined, copy?.declined);
      const orgChose =
        Boolean(copy?.declined?.description) ||
        words.description !== defaultText(OUTCOME_KEYS.declined.description);
      return { tone: 'error', title: words.title, description: orgChose ? words.description : (outcome.reason ?? words.description) };
    }
    case 'in_review':
      return { tone: 'info', ...screen(t, OUTCOME_KEYS.inReview) };
    case 'cancelled':
      return {
        tone: 'error',
        title: CANCELLED_TITLE,
        // The status reason is the checks' finding, never why it was stopped.
        description: DEFAULT_CANCELLED_MESSAGE,
      };
    case 'error':
      return {
        tone: 'error',
        title: 'Something went wrong',
        description: outcome.reason ?? "We couldn't complete your check. Please try again in a moment.",
      };
    default:
      return { tone: 'info', ...screen(t, OUTCOME_KEYS.submitted) };
  }
}
