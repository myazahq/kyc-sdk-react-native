// Address entrance, review and the presence check afterwards.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const ADDRESS_FINISH_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'address.entrance.title': 'Show the entrance',
  'address.entrance.description.framing': 'Frame your entrance in the street imagery. No camera needed.',
  'address.entrance.description.photo': 'A picture of the gate or front door makes the address findable.',
  'address.review.title': 'Confirm your address',
  'address.review.title.business': 'Confirm the premises',
  'address.review.description': 'Check everything is right before you continue.',
  // Street View framing (StreetViewChrome.tsx, FramedStreetView.tsx, EntranceFraming.tsx).
  'address.entrance.framePill': 'Fit your entrance in the frame',
  'address.entrance.frameHint': 'Drag to look around until your gate or front door sits inside the frame.',
  'address.entrance.useView': 'Use this view',
  // The entrance photo (EntranceDropzone.tsx, AddressEntranceStep.tsx).
  'address.photo.cta': 'Take or upload a photo',
  'address.photo.hint': 'The gate, front door or the building itself.',
  'address.entrance.continueWithoutPhoto': 'Continue without a photo',
  // The review card (ReviewAddressBand.tsx, AddressReviewStep.tsx).
  'address.review.badge': 'Pinned address',
  'address.review.badge.business': 'Pinned premises',
  'address.review.edit': 'Edit',
  'address.review.confirm': 'Confirm address',
  // The presence card on the success screen (components/PresenceBlocks.tsx).
  'address.presence.badge': 'Address check active',
  'address.presence.title': 'Your address confirms itself from here',
  'address.presence.description': 'Nothing else for you to do. Carry on as normal.',
  'address.presence.step1.stage': 'Today',
  'address.presence.step1.title': 'Check started',
  'address.presence.step1.caption': 'Your pin is saved. Keep location on.',
  'address.presence.step2.stage': 'Next few days',
  'address.presence.step2.title': 'Quiet check-ins',
  'address.presence.step2.caption': 'Your phone confirms it is at your address now and then.',
  'address.presence.step3.stage': 'Then',
  'address.presence.step3.title': 'Confirmed',
  'address.presence.step3.caption': 'You get a notification. That is it.',
};

export const ADDRESS_FINISH_NOT_SHOWN: Record<string, string> = {};
