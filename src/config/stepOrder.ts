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
//               (documents) → (questionnaire) → (key-people) →
//               (applicant-role → country-select → capture leg) → submitted
//
// Mirrors the web SDK's `lib/step-order.ts`, plus the `nfc` step, which is a
// real step here — the web SDK can't do ISO-DEP so it only previews the screen.
// ---------------------------------------------------------------------------

import type { WorkflowBusinessConfig } from '../types/business';
import type { KYCStep } from '../types/config';
import { applyResubmitSteps, type ResubmitConfig } from '../lib/resubmit';
import { addressFlowSteps, type AddressFlowOptions } from '../lib/address-flow';
import { businessSectionSteps, hasApplicantVerification } from './businessSteps';

export interface StepOrderOptions {
  isBusiness: boolean;
  /** Scoped flows: no identity section — each scope's headline step is the
   *  flow (see lib/scope.ts). */
  scope?: import('../lib/scope').WorkflowScope | null;
  /** Business (KYB) configuration — drives the application-section steps. */
  business?: WorkflowBusinessConfig;
  hasDocCapture: boolean;
  hasNfc: boolean;
  hasLiveness: boolean;
  hasCountrySelect: boolean;
  /**
   * Whether the flow opens on the consent screen. Absent = yes. `false` is the
   * workflow's `consentStep: false`: the host app has already asked, so the
   * flow opens on its first real step instead (config/consentStep.ts).
   */
  hasConsent?: boolean;
  hasEmailVerification: boolean;
  hasPhoneVerification: boolean;
  hasPoa: boolean;
  /**
   * Whether the supporting-documents step has anything to ask for on THIS
   * attempt. Resolved by the caller (config/supportingDocuments.ts) because
   * the list depends on the ID the person actually picked — a document scoped
   * to one ID is not asked of somebody who used another, and a step with an
   * empty list must not appear at all.
   */
  hasSupportingDocuments: boolean;
  hasAddressCollection: boolean;
  /**
   * Which address screens the flow has, from the ONE `addressFlowFor` call.
   * The list is built by `addressFlowSteps`, the same builder the address
   * steps navigate by, so the progress bar and the flow cannot disagree.
   * Absent falls back to the default shape (no search, entrance offered).
   */
  addressFlow?: AddressFlowOptions;
  hasQuestionnaire: boolean;
  /**
   * A reviewer sent this back to redo specific steps.
   *
   * Applied LAST, over the fully-built order, so it narrows whatever the flow
   * would otherwise have been rather than having to know how that order was
   * assembled — which differs between the individual and KYB branches below.
   */
  resubmit?: ResubmitConfig | null;
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
  return applyResubmitSteps(fullStepOrder(o), o.resubmit);
}

/** The flow's opening screen: consent, unless the workflow switched it off. */
function openingSteps(o: StepOrderOptions): KYCStep[] {
  return o.hasConsent === false ? [] : ['consent'];
}

/** The flow as configured, before any reviewer narrowing. */
function fullStepOrder(o: StepOrderOptions): KYCStep[] {
  // Business (KYB) flow — the application section, then (when the workflow
  // requires applicant verification) the ordinary individual capture leg.
  if (o.isBusiness) {
    // The questionnaire sits INSIDE the business section (before key people) —
    // its questions are about the company, so it stays with the company form
    // rather than trailing the applicant's own capture leg.
    const steps: KYCStep[] = [
      ...openingSteps(o),
      ...contactSteps(o),
      ...businessSectionSteps(o.business, o.hasQuestionnaire, o.hasAddressCollection),
    ];
    if (hasApplicantVerification(o.business)) {
      // The applicant may hold an ID issued anywhere the org can verify —
      // more than one granted country (hasCountrySelect, derived from the
      // server config for business flows) means they pick theirs first,
      // exactly like a multi-region individual flow.
      if (o.hasCountrySelect) steps.push('country-select');
      steps.push('id-type', ...captureLeg(o));
    }
    steps.push('submitted');
    return steps;
  }

  // Scoped flows: the scope's headline section IS the flow.
  if (o.scope === 'address') {
    const steps: KYCStep[] = [...openingSteps(o), ...contactSteps(o)];
    if (o.hasPoa) steps.push('proof-of-address');
    // Gated like the full flow, and like Flutter has always done it: an
    // address flow that asks only for proof of address never opens a map.
    if (o.hasAddressCollection) {
      steps.push(
        ...addressFlowSteps(
          o.addressFlow ?? { searchAvailable: false, photoMode: 'optional', streetViewOffered: false },
        ),
      );
    }
    if (o.hasQuestionnaire) steps.push('questionnaire');
    steps.push('submitted');
    return steps;
  }
  if (o.scope === 'biometric-authentication' || o.scope === 'biometric-enrollment') {
    const steps: KYCStep[] = [...openingSteps(o), ...contactSteps(o), 'liveness'];
    if (o.hasQuestionnaire) steps.push('questionnaire');
    steps.push('submitted');
    return steps;
  }
  if (o.scope === 'questionnaire') {
    return [...openingSteps(o), ...contactSteps(o), 'questionnaire', 'submitted'];
  }
  if (o.scope === 'contact') {
    return [...openingSteps(o), ...contactSteps(o), 'submitted'];
  }

  const middle: KYCStep[] = [...captureLeg(o)];
  // Paperwork the org files comes BEFORE the address evidence the
  // verification is judged on (user decision 2026-09-22).
  if (o.hasSupportingDocuments) middle.push('supporting-documents');
  if (o.hasPoa) middle.push('proof-of-address');
  // The address flow is FOUR real steps on an individual flow (find it, confirm
  // it, show it, commit it), so the progress bar advances through them and back
  // is ordinary step navigation. KYB keeps the single premises step, inserted
  // by businessSectionSteps above.
  if (o.hasAddressCollection) {
    middle.push(
      ...addressFlowSteps(
        o.addressFlow ?? {
          searchAvailable: false,
          photoMode: 'optional',
          streetViewOffered: false,
        },
      ),
    );
  }
  if (o.hasQuestionnaire) middle.push('questionnaire');
  return [
    ...openingSteps(o),
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

/**
 * The step before `step` — what the back button goes to.
 *
 * A step not in the order stands still, for the same reason `nextStepInOrder`
 * refuses to guess at one: it has no predecessor in a flow that does not
 * contain it. This used to fall through to `order[0]`, so an applicant resumed
 * onto a step the flow had since dropped was thrown all the way back to consent
 * by a single back-press, discarding everything they had done. Standing still
 * is recoverable; that was not.
 */
export function previousStepInOrder(step: KYCStep, o: StepOrderOptions): KYCStep {
  const order = buildStepOrder(o);
  const index = order.indexOf(step);
  if (index < 0) return step;
  if (index === 0) return order[0]!;
  return order[index - 1]!;
}
