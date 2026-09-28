import { configScope, isFaceScope } from '../../lib/scope';
import type { MyazaKYCConfig } from '../../types/config';
import type { IconName } from '../../components/Icon';
import { fillTokens } from '../../utils/tokens';
import { defaultText } from '../../i18n/translate';
import type { TextFn } from '../../i18n/types';
import {
  ADDRESS_PIN_BULLETS,
  CONTACT_BULLET_KEYS,
  DEFAULT_BUSINESS_DESCRIPTION,
  SCOPE_BULLETS,
  SCOPE_DESCRIPTIONS,
  SCOPE_TITLES,
  type Bullet,
} from './copy';
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

/**
 * `t` resolves the customisable texts (a workflow's own words); the variant
 * titles and descriptions (business, a scope, a greeting by name) are not
 * customisable, as on web, but the older `consent.*` fields still win there.
 */
export function buildConsentModel(config: MyazaKYCConfig, t: TextFn = defaultText): ConsentModel {
  const bullet = (b: Bullet): ConsentProcessStep => ({ icon: b.icon, label: t(b.key) });
  const isBusiness = config.subjectType === 'business';
  const scope = isBusiness ? null : configScope(config);
  const faceScope = isFaceScope(scope);
  const firstName = config.userData?.firstName ?? '';

  const variantTitle = firstName
    ? `Welcome, ${firstName}`
    : isBusiness
      ? 'Business Verification'
      : SCOPE_TITLES[scope ?? ''];
  const title =
    variantTitle === undefined
      ? t('welcome.title', undefined, config.consent?.title)
      : config.consent?.title
        ? fillTokens(config.consent.title, config.userData)
        : variantTitle;
  const variantDescription = isBusiness ? DEFAULT_BUSINESS_DESCRIPTION : SCOPE_DESCRIPTIONS[scope ?? ''];
  const description =
    variantDescription === undefined
      ? t('welcome.description', undefined, config.consent?.description)
      : config.consent?.description
        ? fillTokens(config.consent.description, config.userData)
        : variantDescription;

  // A business flow captures a face only when the applicant verifies their own
  // identity in-flow; an individual flow whenever the selfie step is on.
  const capturesFace = isBusiness
    ? hasApplicantVerification(config.business)
    : faceScope || (!scope && config.enableSelfie !== false);
  const recordsVideo =
    capturesFace || (!isBusiness && !scope && config.enableDocumentCapture !== false);

  const steps: ConsentProcessStep[] = (
    (isBusiness
      ? [
          { icon: 'building-2', key: 'welcome.process.businessDetails' },
          { icon: 'badge-check', key: 'welcome.process.businessRegistry' },
        ]
      : scope
        ? scope === 'address'
          ? hasAddressCollectionStep(config.addressCollection)
            ? ADDRESS_PIN_BULLETS
            : []
          : SCOPE_BULLETS[scope] ?? []
        : [
            { icon: 'badge-check', key: 'welcome.process.verifyId' },
            { icon: 'user', key: 'welcome.process.personalInfo' },
          ]) as Bullet[]
  ).map(bullet); // a fresh array: the pushes below never touch the constants
  // On the CONTACT scope the catalogue bullet already says this — appending
  // the generic line showed "confirm your contact details" twice the moment
  // both channels were on.
  const hasEmail = hasEmailVerificationStep(config.emailVerification);
  const hasPhone = hasPhoneVerificationStep(config.phoneVerification);
  if (scope !== 'contact' && (hasEmail || hasPhone)) {
    const key = CONTACT_BULLET_KEYS[hasEmail && hasPhone ? 'both' : hasEmail ? 'email' : 'phone'];
    steps.push(bullet({ icon: 'lock', key }));
  }
  if (!isBusiness && !scope && config.enableDocumentCapture !== false) {
    steps.push(bullet({ icon: 'scan-line', key: 'welcome.process.captureDocument' }));
  }
  // Chip-capable IDs additionally read the document's NFC chip — listed when
  // the flow enables NFC so the user knows to have the physical document to
  // hand (a non-chip ID simply skips the step). Individual flows only; a KYB
  // config can't carry `nfc`.
  if (!isBusiness && !scope && config.nfc?.enabled) {
    steps.push({ icon: 'nfc', label: 'Scan your document’s security chip (NFC)' });
  }
  if (!isBusiness && !scope && config.enableSelfie !== false) {
    steps.push(bullet({ icon: 'scan-face', key: 'welcome.process.selfie' }));
  }
  // Post-capture features, in the order the flow runs them. Each is gated on
  // the flow that actually asks for it, and skipped where a scope's own
  // catalogue bullet already covers the same step.
  // `mayAsk`, NOT the step-order predicate: that one resolves against the
  // verified IDs and consent runs before an ID is picked, so every scoped
  // document would answer "nothing to ask for" and go undisclosed.
  if (!isBusiness && mayAskSupportingDocuments(config.supportingDocuments)) {
    steps.push(bullet({ icon: 'file-text', key: 'welcome.process.supportingDocuments' }));
  }
  if (!isBusiness && hasProofOfAddressStep(config.proofOfAddress)) {
    steps.push(bullet({ icon: 'file-text', key: 'welcome.process.proofOfAddress' }));
  }
  if (scope !== 'address' && hasAddressCollectionStep(config.addressCollection)) {
    steps.push(bullet({ icon: 'map-pin-house', key: 'welcome.process.addressMap' }));
  }
  // The step-order predicate, not a raw fields check: a questionnaire with
  // questions but enabled: false never runs, so it must not be promised.
  if (scope !== 'questionnaire' && hasActiveQuestionnaire(config.questionnaire)) {
    steps.push(bullet({ icon: 'badge-check', key: 'welcome.process.questions' }));
  }
  if (isBusiness && hasKeyPeopleCollection(config.business)) {
    steps.push(bullet({ icon: 'users', key: 'welcome.process.keyPeople' }));
  }
  if (isBusiness && hasBusinessDocumentsStep(config.business)) {
    steps.push(bullet({ icon: 'file-text', key: 'welcome.process.businessDocuments' }));
  }
  if (isBusiness && hasApplicantVerification(config.business)) {
    steps.push(bullet({ icon: 'scan-face', key: 'welcome.process.applicant' }));
  }

  return { isBusiness, title, description, steps, capturesFace, recordsVideo };
}
