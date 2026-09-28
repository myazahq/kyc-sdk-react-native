// The business (KYB) details, documents and applicant steps.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const BUSINESS_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'business.details.title': 'Business Details',
  'business.details.description': 'Provide your business registration details for verification against the official registry.',
  'business.documents.title': 'Business documents',
  'business.documents.description': 'Upload the supporting documents for your business. Each one must clearly show the registered business name and registration number. Required documents are marked with *.',
  'business.applicant.title': 'Now verify your own identity',
  'business.applicant.description': 'Tell us your role at the business, then verify your identity with a government-issued ID.',

  // The details step (screens/BusinessDetailsStep.tsx and its parts).
  'business.details.countryLabel': 'Country of registration',
  'business.search.manualEntry': 'Enter the details myself',
  'business.details.registrationNumberLabel': 'Registration number',
  'business.details.nameLabel': 'Registered business name',
  'business.companyInfo.title': 'Company information',
  'business.companyInfo.description': 'We verify these details against the official registry record.',
  'business.contactEmail.label': 'Contact email for owner verification',
  'business.contactEmail.hint': "We'll email this address a link for your directors and owners to verify their identity.",
  'business.details.checkNote': 'Continue checks this business against the official register and brings back its details.',
  'business.details.confirm': 'Confirm details & continue',

  // The applicant step (screens/ApplicantRoleStep.tsx).
  'business.applicant.notice': 'Regulations require the person submitting a business application to verify their own identity. This only takes a minute.',
  'business.applicant.whoLabel': 'Are you one of the people you listed?',
  'business.applicant.notListed': "I'm not one of these people",
  'business.applicant.selfNote': "You'll verify your identity at the end of this form, so no separate invite link is needed for you.",
  'business.applicant.roleLabel': 'Your role at the business',
};

export const BUSINESS_NOT_SHOWN: Record<string, string> = {};
