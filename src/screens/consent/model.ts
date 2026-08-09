import type { MyazaKYCConfig } from '../../types/config';
import type { IconName } from '../../components/Icon';
import { fillTokens } from '../../utils/tokens';
import { hasEmailVerificationStep, hasPhoneVerificationStep } from '../../config/contact';
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

export function buildConsentModel(config: MyazaKYCConfig): ConsentModel {
  const isBusiness = config.subjectType === 'business';
  const firstName = config.userData?.firstName ?? '';

  const defaultTitle = firstName
    ? `Welcome, ${firstName}`
    : isBusiness
      ? 'Business Verification'
      : 'Identity Verification';
  const title = config.consent?.title
    ? fillTokens(config.consent.title, config.userData)
    : defaultTitle;
  const description = config.consent?.description
    ? fillTokens(config.consent.description, config.userData)
    : isBusiness
      ? DEFAULT_BUSINESS_DESCRIPTION
      : DEFAULT_DESCRIPTION;

  // A business flow captures a face only when the applicant verifies their own
  // identity in-flow; an individual flow whenever the selfie step is on.
  const capturesFace = isBusiness
    ? hasApplicantVerification(config.business)
    : config.enableSelfie !== false;
  const recordsVideo = capturesFace || (!isBusiness && config.enableDocumentCapture !== false);

  const steps: ConsentProcessStep[] = isBusiness
    ? [
        { icon: 'building-2', label: 'Collect your business registration details' },
        { icon: 'badge-check', label: 'Verify your business against the official registry' },
      ]
    : [
        { icon: 'badge-check', label: 'Verify your government-issued ID' },
        { icon: 'user', label: 'Collect basic personal information' },
      ];
  if (hasEmailVerificationStep(config.emailVerification) || hasPhoneVerificationStep(config.phoneVerification)) {
    steps.push({ icon: 'lock', label: 'Confirm your contact details with a one-time code' });
  }
  if (!isBusiness && config.enableDocumentCapture !== false) {
    steps.push({ icon: 'scan-line', label: 'Capture a photo of your ID document' });
  }
  // Chip-capable IDs additionally read the document's NFC chip — listed when
  // the flow enables NFC so the user knows to have the physical document to
  // hand (a non-chip ID simply skips the step). Individual flows only; a KYB
  // config can't carry `nfc`.
  if (!isBusiness && config.nfc?.enabled) {
    steps.push({ icon: 'nfc', label: 'Scan your document’s security chip (NFC)' });
  }
  if (!isBusiness && config.enableSelfie !== false) {
    steps.push({ icon: 'scan-face', label: 'Take a selfie for facial verification' });
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
