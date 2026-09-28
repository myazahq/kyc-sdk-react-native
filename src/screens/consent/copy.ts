import type { IconName } from '../../components/Icon';

// The consent screen's fixed copy: the variant titles and descriptions (not
// customisable, as on web) and the process bullets, which carry text KEYS so
// a workflow's own words reach them. Split from model.ts (200-line rule).

export const DEFAULT_BUSINESS_DESCRIPTION =
  'We need to verify your business to comply with regulatory requirements. This process is quick and secure.';

export const SCOPE_TITLES: Record<string, string> = {
  address: 'Address Verification',
  'biometric-authentication': 'Face Check',
  'biometric-enrollment': 'Face Enrolment',
  questionnaire: 'A Few Questions',
  contact: 'Confirm Your Contact Details',
};

export const SCOPE_DESCRIPTIONS: Record<string, string> = {
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
// Bullets carry text KEYS; buildConsentModel resolves them through `t`.
export type Bullet = { icon: IconName; key: string };

export const ADDRESS_PIN_BULLETS: Bullet[] = [
  { icon: 'map-pin-house', key: 'welcome.process.addressPin' },
  { icon: 'badge-check', key: 'welcome.process.addressDetails' },
];

export const SCOPE_BULLETS: Record<string, Bullet[]> = {
  'biometric-authentication': [
    { icon: 'scan-face', key: 'welcome.process.faceSelfie' },
    { icon: 'badge-check', key: 'welcome.process.faceMatch' },
  ],
  'biometric-enrollment': [
    { icon: 'scan-face', key: 'welcome.process.faceSelfie' },
    { icon: 'badge-check', key: 'welcome.process.faceEnrol' },
  ],
  questionnaire: [{ icon: 'badge-check', key: 'welcome.process.questions' }],
  contact: [{ icon: 'lock', key: 'welcome.process.contactScope' }],
};

export const CONTACT_BULLET_KEYS = {
  both: 'welcome.process.contactEmailAndPhone',
  email: 'welcome.process.contactEmail',
  phone: 'welcome.process.contactPhone',
} as const;
