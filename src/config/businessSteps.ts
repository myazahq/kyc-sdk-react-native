// ---------------------------------------------------------------------------
// Business (KYB) APPLICATION step gates.
//
// Which steps a KYB workflow adds beyond the registration details: key-people
// collection, supporting documents, and applicant identity verification. Single
// source of truth for what is in the flow and in what order — the step order,
// the progress bar, and each step's navigation all read these.
//
// Mirrors the web SDK's `lib/business-application.ts` (the sequencing half; the
// row-validation/payload half lands with the KYB step itself).
// ---------------------------------------------------------------------------

import type { BusinessDocumentKey, WorkflowBusinessConfig } from '../types/business';
import type { KYCStep } from '../types/config';

/** Default display labels per document key (server contract). */
export const BUSINESS_DOCUMENT_LABELS: Record<BusinessDocumentKey, string> = {
  incorporation_certificate: 'Certificate of incorporation',
  memart: 'MEMART / articles of association',
  proof_of_address: 'Proof of business address',
  tax_document: 'Tax document',
  regulatory_license: 'Regulatory license',
  board_resolution: 'Board resolution',
  other: 'Other document',
};

/** Whether the flow collects key people from the applicant. */
export function hasKeyPeopleCollection(business: WorkflowBusinessConfig | undefined): boolean {
  return business?.keyPeople?.enabled === true && business.keyPeople.collect === true;
}

/** Whether the flow collects supporting business documents. */
export function hasBusinessDocumentsStep(business: WorkflowBusinessConfig | undefined): boolean {
  return business?.documents?.enabled === true;
}

/** Whether the applicant verifies their own identity in-flow. */
export function hasApplicantVerification(business: WorkflowBusinessConfig | undefined): boolean {
  return business?.applicant?.verification === true;
}

export interface ResolvedBusinessDocumentType {
  key: BusinessDocumentKey;
  label: string;
  required: boolean;
}

/**
 * The document slots the flow renders. Enabled with absent/empty `types`
 * defaults to just a required incorporation certificate (server contract).
 */
export function resolveBusinessDocumentTypes(
  business: WorkflowBusinessConfig | undefined,
): ResolvedBusinessDocumentType[] {
  if (!hasBusinessDocumentsStep(business)) return [];
  const types = business?.documents?.types;
  if (!types || types.length === 0) {
    return [
      {
        key: 'incorporation_certificate',
        label: BUSINESS_DOCUMENT_LABELS.incorporation_certificate,
        required: true,
      },
    ];
  }
  return types.map((t) => ({
    key: t.key,
    label: t.label ?? BUSINESS_DOCUMENT_LABELS[t.key] ?? t.key,
    required: t.required === true,
  }));
}

/** Minimum applicant-listed people the workflow demands (0 = skippable). */
export function keyPeopleMinEntries(business: WorkflowBusinessConfig | undefined): number {
  const kp = business?.keyPeople;
  if (!kp?.enabled || !kp.collect) return 0;
  return kp.minEntries ?? 0;
}

export type BusinessSectionStep =
  | 'business-details'
  | 'business-key-people'
  | 'business-documents'
  | 'applicant-role';

/** The ordered business-application steps this workflow configures. */
export function businessSectionSteps(
  business: WorkflowBusinessConfig | undefined,
): BusinessSectionStep[] {
  const steps: BusinessSectionStep[] = ['business-details'];
  if (hasKeyPeopleCollection(business)) steps.push('business-key-people');
  if (hasBusinessDocumentsStep(business)) steps.push('business-documents');
  if (hasApplicantVerification(business)) steps.push('applicant-role');
  return steps;
}

/** Type guard so the step order can be walked without casting. */
export function isBusinessSectionStep(step: KYCStep): step is BusinessSectionStep {
  return (
    step === 'business-details' ||
    step === 'business-key-people' ||
    step === 'business-documents' ||
    step === 'applicant-role'
  );
}
