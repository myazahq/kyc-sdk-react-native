// ---------------------------------------------------------------------------
// Proof of Address — the pure half.
//
// A recent utility bill / bank statement / tenancy document, read server-side
// and cross-checked against the subject's name and a recency window. The result
// is a SOFT sub-result: it never changes the verification's own status, it
// feeds decisioning. So nothing here should block a user over a judgement the
// server is going to make anyway.
// ---------------------------------------------------------------------------

import type { PoaDocumentType, PoaNameRule, ProofOfAddressConfig } from '../types/workflow';

export const POA_TYPE_LABELS: Record<PoaDocumentType, string> = {
  utility_bill: 'Utility bill',
  bank_statement: 'Bank statement',
  tenancy_agreement: 'Tenancy agreement',
  government_document: 'Government-issued document',
  other: 'Other document',
};

const ALL_POA_TYPES: PoaDocumentType[] = [
  'utility_bill',
  'bank_statement',
  'tenancy_agreement',
  'government_document',
  'other',
];

/** A kind THIS build can label and draw. A newer kind the dashboard offers
 *  before the SDK ships is hidden rather than rendered as a blank row. */
const knownKinds = (kinds: readonly string[] | undefined): PoaDocumentType[] =>
  (kinds ?? []).filter((k): k is PoaDocumentType => (ALL_POA_TYPES as string[]).includes(k));

/** Default recency window the server checks the document date against. */
export const DEFAULT_POA_MAX_AGE_DAYS = 90;

/** Whether the step is part of the flow. */
export function hasProofOfAddressStep(poa: ProofOfAddressConfig | undefined | null): boolean {
  return poa?.enabled === true;
}

/**
 * The document kinds on offer for `country` (mirror of the web SDK's
 * `poaOfferedKinds` — keep the three in lockstep): that country's override
 * when the workflow declares one, else the global list, else all four.
 */
export function poaDocumentTypes(
  poa: ProofOfAddressConfig | undefined,
  country?: string | null,
): PoaDocumentType[] {
  const override = knownKinds(country ? poa?.countryDocuments?.[country.toUpperCase()] : undefined);
  if (override.length > 0) return override;
  const configured = knownKinds(poa?.documentTypes);
  return configured.length > 0 ? configured : ALL_POA_TYPES;
}

/**
 * The name rule the server judges THIS document under — the country's per-kind
 * exception, else the workflow default, else `required`. Mirror of the web
 * SDK's `poaNamePolicy` and the server's `resolvePoaNamePolicy` — keep in
 * lockstep. Read only to word the step: under `off` the header stops asking
 * for the applicant's name.
 */
export function poaNamePolicy(
  poa: ProofOfAddressConfig | undefined | null,
  country: string | undefined | null,
  kind: PoaDocumentType | undefined | null,
): PoaNameRule {
  const exception = country && kind ? poa?.countryNameMatch?.[country.toUpperCase()]?.[kind] : undefined;
  if (exception === 'required' || exception === 'optional' || exception === 'off') return exception;
  const def = poa?.nameMatch;
  return def === 'optional' || def === 'off' ? def : 'required';
}

/**
 * Whether the org's accepted-country list admits `country`. An empty list
 * accepts everyone; an unknown country is not refused here (the server is the
 * gate, and it is soft on full flows).
 */
export function poaCountryAccepted(
  poa: ProofOfAddressConfig | undefined | null,
  country: string | undefined | null,
): boolean {
  const accepted = poa?.countries;
  if (!accepted?.length || !country) return true;
  const code = country.toUpperCase();
  return accepted.some((c) => c.toUpperCase() === code);
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

export function isAcceptedPoaMimeType(mimeType: string | undefined): boolean {
  const base = (mimeType?.split(';')[0] ?? '').trim().toLowerCase();
  return (POA_ACCEPTED_MIME_TYPES as readonly string[]).includes(base);
}
