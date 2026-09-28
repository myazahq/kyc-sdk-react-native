// The document chip (NFC) step.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const NFC_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'nfc.title': 'Scan Document Chip',
  'nfc.description': 'Hold your document to the back of your phone.',

  // The read (screens/nfc/NfcReadProgress.tsx, NfcReadActions.tsx, NfcMrzPrompt.tsx).
  'nfc.waiting': 'Waiting for the chip',
  'nfc.skip': 'Continue without the chip',
};

export const NFC_NOT_SHOWN: Record<string, string> = {};
