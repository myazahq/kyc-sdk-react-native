// The supporting documents step.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const SUPPORTING_DOCUMENTS_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'supportingDocuments.title': 'Supporting documents',
  'supportingDocuments.intro.optional.one': 'Upload this document if you have it, so we can keep it on file. You can skip it.',
  'supportingDocuments.intro.optional.many': 'Upload any of these you have, so we can keep them on file. You can skip the rest.',
  'supportingDocuments.intro.required.one': 'We need this document to continue. Upload it below.',

  // Each document's card (screens/supportingDocumentParts.tsx). The reads
  // heading is drawn in capitals by the style, as the web SDK does.
  'supportingDocuments.card.required': 'Required',
  'supportingDocuments.card.optional': 'Optional',
  'supportingDocuments.card.reads': 'What we read from it',
};

export const SUPPORTING_DOCUMENTS_NOT_SHOWN: Record<string, string> = {};
