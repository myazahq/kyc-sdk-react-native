// ---------------------------------------------------------------------------
// Proof of Address — the pure half.
//
// A recent utility bill / bank statement / tenancy document, read server-side
// and cross-checked against the subject's name and a recency window. The result
// is a SOFT sub-result: it never changes the verification's own status, it
// feeds decisioning. So nothing here should block a user over a judgement the
// server is going to make anyway.
// ---------------------------------------------------------------------------

import type { PoaDocumentType, ProofOfAddressConfig } from '../types/workflow';

export const POA_TYPE_LABELS: Record<PoaDocumentType, string> = {
  utility_bill: 'Utility bill',
  bank_statement: 'Bank statement',
  tenancy_agreement: 'Tenancy agreement',
  other: 'Other document',
};

const ALL_POA_TYPES: PoaDocumentType[] = [
  'utility_bill',
  'bank_statement',
  'tenancy_agreement',
  'other',
];

/** Default recency window the server checks the document date against. */
export const DEFAULT_POA_MAX_AGE_DAYS = 90;

/** Whether the step is part of the flow. */
export function hasProofOfAddressStep(poa: ProofOfAddressConfig | undefined | null): boolean {
  return poa?.enabled === true;
}

/** The document kinds on offer. An absent or empty list means all of them. */
export function poaDocumentTypes(poa: ProofOfAddressConfig | undefined): PoaDocumentType[] {
  const configured = poa?.documentTypes;
  return configured && configured.length > 0 ? configured : ALL_POA_TYPES;
}

/**
 * The label for a kind.
 *
 * `otherLabel` lets an org name what "other" means for them ("Council tax
 * letter"), which is the difference between a user knowing what to upload and
 * guessing.
 */
export function poaTypeLabel(type: PoaDocumentType, poa: ProofOfAddressConfig | undefined): string {
  const custom = poa?.otherLabel?.trim();
  if (type === 'other' && custom) return custom;
  return POA_TYPE_LABELS[type];
}

export function poaMaxAgeDays(poa: ProofOfAddressConfig | undefined): number {
  return poa?.maxAgeDays ?? DEFAULT_POA_MAX_AGE_DAYS;
}

/** Accepted upload types — the only media kind that takes a PDF. */
export const POA_ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

/**
 * Local size cap, matching the web SDK. The server allows more, but rejecting
 * here gives an immediate, specific message instead of a slow 413.
 */
export const POA_MAX_BYTES = 20 * 1024 * 1024;

export function isAcceptedPoaMimeType(mimeType: string | undefined): boolean {
  const base = (mimeType?.split(';')[0] ?? '').trim().toLowerCase();
  return (POA_ACCEPTED_MIME_TYPES as readonly string[]).includes(base);
}
