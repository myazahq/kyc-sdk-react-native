// The email and phone one-time-code steps.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const CONTACT_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'contact.email.title': 'Verify your email',
  'contact.phone.title': 'Verify your phone number',
  'contact.email.intro': "We'll send a one-time code to confirm this email belongs to you.",

  // Entry (screens/ContactDestinationField.tsx, ContactChannelChoice.tsx).
  'contact.email.label': 'Email address',
  'contact.phone.label': 'Phone number',
  'contact.channel.question': 'How should we send it?',
  // Actions and reassurance (screens/ContactActions.tsx, ContactFooterNote.tsx).
  'contact.sendCode': 'Send code',
  'contact.verifyCode': 'Verify code',
  'contact.skip': 'Skip for now',
  'contact.email.footer': 'We only use this to verify your identity.',
  'contact.phone.footer': 'Standard message rates may apply.',
  // Code entry (components/ContactCodeEntry.tsx, screens/ContactCodeStep.tsx).
  'contact.code.label': 'Verification code',
  'contact.code.resend': 'Resend code',
};

export const CONTACT_NOT_SHOWN: Record<string, string> = {};
