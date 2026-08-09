// ---------------------------------------------------------------------------
// Flow step ordering + progress accounting.
//
// ONE definition of the sequence, which navigation, the back button and the
// progress bar all read. The store used to carry a hand-written `switch` per
// direction; every optional step added there was two more cases to keep in
// agreement, and forward and backward could disagree. An explicit ordered list
// with index ±1 cannot.
//
//   individual: consent → (email) → (phone) → (country-select) → id-type →
//               capture → (nfc) → (liveness) → (poa) → (questionnaire) →
//               submitted
//   business:   consent → (email) → (phone) → business-details →
//               (key-people) → (documents) → (applicant-role → capture leg) →
//               (questionnaire) → submitted
//
// Mirrors the web SDK's `lib/step-order.ts`, plus the `nfc` step, which is a
// real step here — the web SDK can't do ISO-DEP so it only previews the screen.
// ---------------------------------------------------------------------------

import type { WorkflowBusinessConfig } from '../types/business';
import type { KYCStep } from '../types/config';
import { businessSectionSteps, hasApplicantVerification } from './businessSteps';

export interface StepOrderOptions {
  isBusiness: boolean;
  /** Business (KYB) configuration — drives the application-section steps. */
  business?: WorkflowBusinessConfig;
  hasDocCapture: boolean;
  hasNfc: boolean;
  hasLiveness: boolean;
  hasCountrySelect: boolean;
  hasEmailVerification: boolean;
  hasPhoneVerification: boolean;
  hasPoa: boolean;
  hasQuestionnaire: boolean;
}

// Contact-verification OTP steps sit right after consent (both flows) — a cheap
// pre-filter before capture/registry spend; email before phone.
function contactSteps(o: StepOrderOptions): KYCStep[] {
  return [
    ...(o.hasEmailVerification ? (['email-verification'] as KYCStep[]) : []),
    ...(o.hasPhoneVerification ? (['phone-verification'] as KYCStep[]) : []),
  ];
}

/** The individual capture leg — shared by the KYC flow and the KYB applicant. */
function captureLeg(o: StepOrderOptions): KYCStep[] {
  const steps: KYCStep[] = [o.hasDocCapture ? 'document-capture' : 'id-input'];
  // The chip read follows the photo: the MRZ from that capture is what unlocks
  // the chip, so there is nothing to read before it.
  if (o.hasNfc && o.hasDocCapture) steps.push('nfc');
  if (o.hasLiveness) steps.push('liveness');
  return steps;
}

export function buildStepOrder(o: StepOrderOptions): KYCStep[] {
  // Business (KYB) flow — the application section, then (when the workflow
  // requires applicant verification) the ordinary individual capture leg.
  if (o.isBusiness) {
    const steps: KYCStep[] = ['consent', ...contactSteps(o), ...businessSectionSteps(o.business)];
    if (hasApplicantVerification(o.business)) {
      // The applicant may hold an ID issued anywhere the org can verify —
      // more than one granted country (hasCountrySelect, derived from the
      // server config for business flows) means they pick theirs first,
      // exactly like a multi-region individual flow.
      if (o.hasCountrySelect) steps.push('country-select');
      steps.push('id-type', ...captureLeg(o));
    }
    if (o.hasQuestionnaire) steps.push('questionnaire');
    steps.push('submitted');
    return steps;
  }

  const middle: KYCStep[] = [...captureLeg(o)];
  if (o.hasPoa) middle.push('proof-of-address');
  if (o.hasQuestionnaire) middle.push('questionnaire');
  return [
    'consent',
    ...contactSteps(o),
    ...(o.hasCountrySelect ? (['country-select'] as KYCStep[]) : []),
    'id-type',
    ...middle,
    'submitted',
  ];
}

/** Percentage complete for the progress bar. */
export function getStepProgress(step: KYCStep, o: StepOrderOptions): number {
  const order = buildStepOrder(o);
  const index = order.indexOf(step);
  if (index === -1) return 0;
  return Math.round(((index + 1) / order.length) * 100);
}

/**
 * The step that follows `step`.
 *
 * A step not in the order (a workflow toggled it off after the user reached it,
 * or a preview jumped straight to it) is left where it is rather than guessed
 * at — advancing from a step the flow does not contain has no correct answer,
 * and moving somewhere arbitrary is worse than standing still.
 */
export function nextStepInOrder(step: KYCStep, o: StepOrderOptions): KYCStep {
  const order = buildStepOrder(o);
  const index = order.indexOf(step);
  if (index === -1) return step;
  return order[index + 1] ?? order[order.length - 1]!;
}

/** The step before `step` — what the back button goes to. */
export function previousStepInOrder(step: KYCStep, o: StepOrderOptions): KYCStep {
  const order = buildStepOrder(o);
  const index = order.indexOf(step);
  if (index <= 0) return order[0]!;
  return order[index - 1]!;
}
