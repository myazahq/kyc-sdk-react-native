import { configScope, isFaceScope } from '../../lib/scope';
import type { MyazaKYCConfig } from '../../types/config';
import type { IconName } from '../../components/Icon';
import { fillTokens } from '../../utils/tokens';
import { hasEmailVerificationStep, hasPhoneVerificationStep } from '../../config/contact';
import { hasActiveQuestionnaire } from '../../config/questionnaire';
import { hasProofOfAddressStep } from '../../config/proofOfAddress';
import { mayAskSupportingDocuments } from '../../config/supportingDocuments';
import { hasAddressCollectionStep } from '../../config/addressCollection';
import {
  hasApplicantVerification,
  hasBusinessDocumentsStep,
  hasKeyPeopleCollection,
} from '../../config/businessSteps';

// ---------------------------------------------------------------------------
// What the consent screen SAYS, derived from what the flow actually DOES.
//
// Mirrors the web SDK's ConsentStep derivations exactly — a KYB flow gets the
// business title, description, step list and data clause, never the identity
// copy ("verify your government-issued ID" on a registry-lookup flow is simply
// false). The biometric sentence is derived, not assumed: claiming facial
// recognition on a flow with no face capture would be a false statement in a
// legal notice, and recording video without saying so is the failure that
// actually carries risk.
//
// Pure (no RN imports beyond types) so it is unit-testable next to the web
// SDK's consent-disclosure tests. The screen just renders this.
// ---------------------------------------------------------------------------

export interface ConsentProcessStep {
  icon: IconName;
  label: string;
}

export interface ConsentModel {
  isBusiness: boolean;
  title: string;
  description: string;
  steps: ConsentProcessStep[];
  /** Drives the "facial recognition" sentence in the legal notice. */
  capturesFace: boolean;
  /** Drives the "recording this session" sentence. */
  recordsVideo: boolean;
}

const DEFAULT_DESCRIPTION =
  'We need to verify your identity to comply with regulatory requirements. This process is quick and secure.';

const DEFAULT_BUSINESS_DESCRIPTION =
  'We need to verify your business to comply with regulatory requirements. This process is quick and secure.';

const SCOPE_TITLES: Record<string, string> = {
  address: 'Address Verification',
  'biometric-authentication': 'Face Check',
  'biometric-enrollment': 'Face Enrolment',
  questionnaire: 'A Few Questions',
  contact: 'Confirm Your Contact Details',
};

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  address:
    'We need to confirm your home address to comply with regulatory requirements. This process is quick and secure.',
  'biometric-authentication':
    'A quick face check confirms it is really you. This takes a few seconds and is secure.',
  'biometric-enrollment':
    'A quick selfie sets up face checks for next time, so you will not have to prove your identity again. This takes a few seconds and is secure.',
  questionnaire:
    'A few questions keep your account details up to date and help us comply with regulatory requirements.',
  contact:
    'We need to re-confirm the email address and phone number on your account. This takes a minute and is secure.',
};

// The address scope's bullets are NOT a fixed pair: it verifies an address by
// the pin, by a document, or by both, so promising a map on a flow that only
// asks for a document is a promise the flow never keeps. Gated below on the
// same step-order predicate the flow itself walks; the document's own bullet is
// appended by the shared post-capture block, like every other flow's.
const ADDRESS_PIN_BULLETS: ConsentProcessStep[] = [
  { icon: 'map-pin-house', label: 'Pin your home address on a map' },
  { icon: 'badge-check', label: 'Confirm the details only you can know' },
];

const SCOPE_BULLETS: Record<string, ConsentProcessStep[]> = {
  'biometric-authentication': [
    { icon: 'scan-face', label: 'Take a quick selfie with liveness checks' },
    { icon: 'badge-check', label: 'We match it against your enrolled face' },
  ],
  'biometric-enrollment': [
    { icon: 'scan-face', label: 'Take a quick selfie with liveness checks' },
    { icon: 'badge-check', label: 'It becomes your face check for next time' },
  ],
  questionnaire: [{ icon: 'badge-check', label: 'Answer a few short questions' }],
  contact: [{ icon: 'lock', label: 'Confirm your contact details with a one-time code' }],
};

export function buildConsentModel(config: MyazaKYCConfig): ConsentModel {
  const isBusiness = config.subjectType === 'business';
  const scope = isBusiness ? null : configScope(config);
  const faceScope = isFaceScope(scope);
  const firstName = config.userData?.firstName ?? '';

  const defaultTitle = firstName
    ? `Welcome, ${firstName}`
    : isBusiness
      ? 'Business Verification'
      : SCOPE_TITLES[scope ?? ''] ?? 'Identity Verification';
  const title = config.consent?.title
    ? fillTokens(config.consent.title, config.userData)
    : defaultTitle;
  const description = config.consent?.description
    ? fillTokens(config.consent.description, config.userData)
    : isBusiness
      ? DEFAULT_BUSINESS_DESCRIPTION
      : SCOPE_DESCRIPTIONS[scope ?? ''] ?? DEFAULT_DESCRIPTION;

  // A business flow captures a face only when the applicant verifies their own
  // identity in-flow; an individual flow whenever the selfie step is on.
  const capturesFace = isBusiness
    ? hasApplicantVerification(config.business)
    : faceScope || (!scope && config.enableSelfie !== false);
  const recordsVideo =
    capturesFace || (!isBusiness && !scope && config.enableDocumentCapture !== false);

  const steps: ConsentProcessStep[] = isBusiness
    ? [
        { icon: 'building-2', label: 'Collect your business registration details' },
        { icon: 'badge-check', label: 'Verify your business against the official registry' },
      ]
    : scope
      ? // COPY the catalogue entry: pushing below would otherwise mutate the
        // shared constant, appending one more bullet per re-render.
        scope === 'address'
          ? hasAddressCollectionStep(config.addressCollection)
            ? [...ADDRESS_PIN_BULLETS]
            : []
          : [...(SCOPE_BULLETS[scope] ?? [])]
      : [
        { icon: 'badge-check', label: 'Verify your government-issued ID' },
        { icon: 'user', label: 'Collect basic personal information' },
      ];
  // On the CONTACT scope the catalogue bullet already says this — appending
  // the generic line showed "confirm your contact details" twice the moment
  // both channels were on.
  const hasEmail = hasEmailVerificationStep(config.emailVerification);
  const hasPhone = hasPhoneVerificationStep(config.phoneVerification);
  if (scope !== 'contact' && (hasEmail || hasPhone)) {
    const what = hasEmail && hasPhone ? 'email and phone number' : hasEmail ? 'email' : 'phone number';
    steps.push({ icon: 'lock', label: `Confirm your ${what} with a one-time code` });
  }
  if (!isBusiness && !scope && config.enableDocumentCapture !== false) {
    steps.push({ icon: 'scan-line', label: 'Capture a photo of your ID document' });
  }
  // Chip-capable IDs additionally read the document's NFC chip — listed when
  // the flow enables NFC so the user knows to have the physical document to
  // hand (a non-chip ID simply skips the step). Individual flows only; a KYB
  // config can't carry `nfc`.
  if (!isBusiness && !scope && config.nfc?.enabled) {
    steps.push({ icon: 'nfc', label: 'Scan your document’s security chip (NFC)' });
  }
  if (!isBusiness && !scope && config.enableSelfie !== false) {
    steps.push({ icon: 'scan-face', label: 'Take a selfie for facial verification' });
  }
  // Post-capture features, in the order the flow runs them. Each is gated on
  // the flow that actually asks for it, and skipped where a scope's own
  // catalogue bullet already covers the same step.
  // `mayAsk`, NOT the step-order predicate: that one resolves against the
  // verified IDs and consent runs before an ID is picked, so every scoped
  // document would answer "nothing to ask for" and go undisclosed.
  if (!isBusiness && mayAskSupportingDocuments(config.supportingDocuments)) {
    steps.push({ icon: 'file-text', label: 'Upload supporting documents' });
  }
  if (!isBusiness && hasProofOfAddressStep(config.proofOfAddress)) {
    steps.push({ icon: 'file-text', label: 'Upload a proof of address document' });
  }
  if (scope !== 'address' && hasAddressCollectionStep(config.addressCollection)) {
    steps.push({ icon: 'map-pin-house', label: 'Pin your address on a map' });
  }
  // The step-order predicate, not a raw fields check: a questionnaire with
  // questions but enabled: false never runs, so it must not be promised.
  if (scope !== 'questionnaire' && hasActiveQuestionnaire(config.questionnaire)) {
    steps.push({ icon: 'badge-check', label: 'Answer a few short questions' });
  }
  if (isBusiness && hasKeyPeopleCollection(config.business)) {
    steps.push({ icon: 'users', label: "List the company's directors and owners" });
  }
  if (isBusiness && hasBusinessDocumentsStep(config.business)) {
    steps.push({ icon: 'file-text', label: 'Upload supporting business documents' });
  }
  if (isBusiness && hasApplicantVerification(config.business)) {
    steps.push({ icon: 'scan-face', label: 'Verify your own identity' });
  }

  return { isBusiness, title, description, steps, capturesFace, recordsVideo };
}
