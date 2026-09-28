// Address search, pin and details.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const ADDRESS_PIN_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'address.search.title': 'Find your address',
  'address.search.description': 'Search it, use your current location, or place a pin on the map.',
  'address.pin.title': 'Is the pin on your building?',
  'address.pin.title.business': 'Is the pin on the premises?',
  'address.pin.description': 'Drag the map until the pin sits exactly on it. You can add details for whoever needs to find it.',
  // Search (screens/address/SearchScreen.tsx, CurrentLocationRow.tsx).
  'address.currentLocation.title': 'Use my current location',
  'address.currentLocation.hint': 'Lands the pin right where you are',
  'address.search.pinInstead': 'Place a pin on the map instead',
  // The flow's escape (screens/address/SkipForNow.tsx).
  'address.skip': 'Skip for now',
  // The pin step (PinSummaryRow.tsx, CurrentLocationRow.tsx LocateChip).
  'address.pin.detailsHint': 'A house number and directions help someone find it',
  'address.pin.editDetails': 'Edit details',
  'address.locate.button': 'Use my location',
  // The keep-or-update question after a pin move (LabelDecisionRow.tsx).
  'address.labelDecision.title': 'You moved the pin',
  'address.labelDecision.keep': 'Keep this address',
  'address.labelDecision.adopt': 'Use the pin’s address',
  // The details sheet (DetailsSheet.tsx).
  'address.details.title': 'Edit your address',
  'address.details.hint':
    'Correct anything the map got wrong. Every field is optional, and it all helps someone find the door.',
};

export const ADDRESS_PIN_NOT_SHOWN: Record<string, string> = {};
