// The proof of address step.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const PROOF_OF_ADDRESS_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'proofOfAddress.title': 'Proof of address',

  // The step (screens/ProofOfAddressStep.tsx, ProofOfAddressParts.tsx).
  'proofOfAddress.documentType': 'Document type',
  'proofOfAddress.uploaded': 'Document uploaded',

  // Document kinds (config/proofOfAddress.ts poaTypeLabel).
  'proofOfAddress.kind.utilityBill': 'Utility bill',
  'proofOfAddress.kind.bankStatement': 'Bank statement',
  'proofOfAddress.kind.tenancyAgreement': 'Tenancy agreement',
  'proofOfAddress.kind.governmentDocument': 'Government-issued document',
  'proofOfAddress.kind.other': 'Other document',
};

export const PROOF_OF_ADDRESS_NOT_SHOWN: Record<string, string> = {};
