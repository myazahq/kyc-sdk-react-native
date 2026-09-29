// The address intro (how it works) screen.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const ADDRESS_INTRO_TEXTS: Record<string, string> = {
  // The header band (screens/address/AddressIntroGate.tsx).
  'address.intro.badge': 'Address verification',
  'address.intro.title': 'Let’s confirm your address',
  'address.intro.description':
    'This address will be verified over the coming days. Your part takes a minute; the rest happens on its own.',
  // The milestone track.
  'address.intro.step1.stage': 'Your part',
  'address.intro.step1.title': 'Pin your address',
  'address.intro.step1.caption': 'Put the pin right on your building. Takes a minute.',
  'address.intro.step2.stage': 'After that',
  'address.intro.step2.title': 'Quiet check-ins',
  'address.intro.step2.caption': 'Keep location on; your phone confirms it over the coming days.',
  'address.intro.step2.caption.background':
    'Allow location all the time when asked. Your phone then confirms it on its own, even with the app closed.',
  'address.intro.step3.stage': 'Then',
  'address.intro.step3.title': 'Confirmed',
  'address.intro.step3.caption': 'You’ll be notified. That is it.',
  // The disclosures (screens/address/IntroDisclosures.tsx). Keep in lockstep
  // with the web and Flutter SDKs: this is the consent artefact.
  'address.intro.howItWorks.title': 'How it works',
  'address.intro.howItWorks.body':
    'After you finish, your device periodically confirms it is at this address over the coming days. Only day-level summaries ever leave your phone, never your movements.',
  'address.intro.howItWorks.body.background':
    'After you finish, your phone confirms it is at this address over the coming days, even when the app is closed. Only day-level summaries ever leave your phone, never your movements.',
  'address.intro.control.title': 'You stay in control',
  'address.intro.control.body':
    'You can turn location off at any time in your device settings. An unfinished check simply expires. It never counts against you.',
  'address.intro.privacy.title': 'Your data is protected',
  'address.intro.privacy.body':
    "Location summaries are used only to confirm this address and are handled under your country's data protection rules.",
  'address.intro.start': 'Continue',
};

export const ADDRESS_INTRO_NOT_SHOWN: Record<string, string> = {};
