// Country, ID type and ID number steps.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const SELECT_DOCUMENT_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'selectDocument.country.title': 'Where was your ID issued?',
  'selectDocument.country.description': 'Choose the country that issued your identity document.',
  'selectDocument.idType.title': 'Select ID Type',
  'selectDocument.idType.description': "Choose the type of identification document you'd like to use.",
  'selectDocument.idInput.description': 'We’ll check this against the official record.',
};

export const SELECT_DOCUMENT_NOT_SHOWN: Record<string, string> = {};
