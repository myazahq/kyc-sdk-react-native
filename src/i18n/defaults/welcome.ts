// The consent (welcome) screen.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const WELCOME_TEXTS: Record<string, string> = {
  'welcome.title': 'Identity Verification',
  'welcome.description':
    'We need to verify your identity to comply with regulatory requirements. This process is quick and secure.',
  'welcome.process.heading': 'DURING THIS PROCESS WE WILL',
  'welcome.process.verifyId': 'Verify your government-issued ID',
  'welcome.process.personalInfo': 'Collect basic personal information',
  'welcome.process.businessDetails': 'Collect your business registration details',
  'welcome.process.businessRegistry': 'Verify your business against the official registry',
  'welcome.process.addressPin': 'Pin your home address on a map',
  'welcome.process.addressDetails': 'Confirm the details only you can know',
  'welcome.process.faceSelfie': 'Take a quick selfie with liveness checks',
  'welcome.process.faceMatch': 'We match it against your enrolled face',
  'welcome.process.faceEnrol': 'It becomes your face check for next time',
  'welcome.process.contactScope': 'Confirm your contact details with a one-time code',
  'welcome.process.contactEmailAndPhone': 'Confirm your email and phone number with a one-time code',
  'welcome.process.contactEmail': 'Confirm your email with a one-time code',
  'welcome.process.contactPhone': 'Confirm your phone number with a one-time code',
  'welcome.process.captureDocument': 'Capture a photo of your ID document',
  'welcome.process.selfie': 'Take a selfie for facial verification',
  'welcome.process.supportingDocuments': 'Upload supporting documents',
  'welcome.process.proofOfAddress': 'Upload a proof of address document',
  'welcome.process.addressMap': 'Pin your address on a map',
  'welcome.process.questions': 'Answer a few short questions',
  'welcome.process.keyPeople': "List the company's directors and owners",
  'welcome.process.businessDocuments': 'Upload supporting business documents',
  'welcome.process.applicant': 'Verify your own identity',
  'welcome.secureNote': 'Your data is encrypted and securely processed',
};

export const WELCOME_NOT_SHOWN: Record<string, string> = {
  'welcome.process.uploadDocument':
    'The consent list has one document bullet, "Capture a photo of your ID document"; there is no upload-only variant.',
};
