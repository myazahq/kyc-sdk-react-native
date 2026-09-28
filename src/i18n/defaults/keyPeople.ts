// The key people step and the people still to verify.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const KEY_PEOPLE_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'keyPeople.title': 'Key people',
  'keyPeople.description': "Add the company's directors, shareholders and beneficial owners.",

  // The step (screens/BusinessKeyPeopleStep.tsx, config/keyPeopleSectionDefs.ts).
  'keyPeople.hints.skippable':
    "You can skip this if you're unsure. We'll identify directors and owners from the official registry. Adding them here speeds up the review.",
  'keyPeople.section.ubos.add': 'Add a beneficial owner',
  'keyPeople.section.shareholders.add': 'Add a shareholder',
  'keyPeople.section.representatives.description': 'People who act on behalf of the company.',
  'keyPeople.section.representatives.add': 'Add a representative',

  // Waiting on the register (screens/KeyPeoplePending.tsx).
  'keyPeople.pending.title': 'Working out who else needs to verify',
  'keyPeople.pending.body': "We are checking the official register for the company's directors and owners.",

  // The people still to verify (screens/KeyPeopleAwaitList.tsx).
  'keyPeople.await.allDone': 'Everyone on this application has completed their identity check.',
  'keyPeople.await.intro':
    'To complete the review, the people below must verify their identity with a KYC check. Anyone with an email on file has already been sent their link.',
  'keyPeople.await.linkValidity': 'Links are valid for 14 days.',
};

export const KEY_PEOPLE_NOT_SHOWN: Record<string, string> = {};
