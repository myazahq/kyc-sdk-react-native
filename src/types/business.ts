// ---------------------------------------------------------------------------
// Business (KYB) workflow types
//
// LIVE business verification is WORKFLOW-REQUIRED: the server only accepts a
// business submission with a published KYB workflow (workflowId or hosted
// link). `subjectType`/`business` also exist as public props for the dashboard
// builder's live preview (`previewMode`, where all writes are mocked).
// ---------------------------------------------------------------------------

/** What a workflow verifies. Absent = 'individual' (classic KYC). */
export type SubjectType = 'individual' | 'business';

/** Associated-party roles discovered from the registry lookup. */
export type KeyPersonRole = 'director' | 'beneficial_owner' | 'signatory' | 'shareholder';

/** Roles the APPLICANT (the person submitting) may declare — key-person roles
 *  plus 'authorized_representative' (someone filing on the company's behalf). */
export type ApplicantRole = KeyPersonRole | 'authorized_representative';

/** Supporting-document kinds a KYB workflow can request from the applicant. */
export const COMPANY_INFO_FIELDS = ['address', 'email', 'phone', 'website'] as const;
export type CompanyInfoField = (typeof COMPANY_INFO_FIELDS)[number];
export type CompanyInfoMode = 'off' | 'optional' | 'required';

export type BusinessDocumentKey =
  | 'incorporation_certificate'
  | 'memart'
  | 'proof_of_address'
  | 'tax_document'
  | 'regulatory_license'
  | 'board_resolution'
  | 'other';

/** Verification depth for discovered key people. */
export type KeyPeopleLevel = 'screening_only' | 'data' | 'full_kyc';

/**
 * Key-people (associated-party) verification block on a KYB workflow —
 * template config that arrives via workflow resolution. Mirrors the server's
 * `KeyPeopleConfigSchema`; the SDK only reads the email-invite gate.
 */
export interface WorkflowKeyPeopleConfig {
  enabled?: boolean;
  /** SDK collects the directors/owners from the applicant (adds the
   *  business-key-people step to the flow). */
  collect?: boolean;
  /** Minimum people the applicant must list when collect is on (0 = skippable). */
  minEntries?: number;
  /** In-scope roles. Absent/empty = all four roles. */
  roles?: KeyPersonRole[];
  /** Shareholders at/above this % escalate to beneficial owner (default 25). */
  ownershipThreshold?: number;
  /** Default verification depth when a role has no `perRole` override. */
  level?: KeyPeopleLevel;
  requirement?: 'all_in_scope' | 'ubos_only' | 'advisory';
  /** Per-role verification depth overrides (win over `level`). */
  perRole?: Partial<Record<KeyPersonRole, KeyPeopleLevel>>;
  /** Invite distribution for full-KYC people. */
  invite?: {
    channel?: string;
    /** The KYC workflow the per-person invite links run through. */
    workflowId?: string;
  };
}

/**
 * A KYB workflow's business configuration block. Business verification is a
 * registry lookup — no ID types, no capture — and the block carries its own
 * registry countries (any provider-supported ISO-2 codes, NOT limited to the
 * individual-KYC catalogue).
 */
export interface WorkflowBusinessConfig {
  /** ISO-2 PRIMARY registry country — the picker's default/pre-selected value. */
  country: string;
  /**
   * Multi-registry: every country the visitor may pick from. Published
   * workflows always carry an explicit list (the server materializes the
   * "all supported countries" mode at publish); absent = just the primary.
   */
  countries?: string[];
  /** Builder marker for "all supported countries" (materialized at publish). */
  allCountries?: boolean;
  /**
   * Offered verification products (keys from the server's business-products
   * catalog, e.g. 'business', 'business-tax'). Absent = just 'business'.
   * The effective offering narrows per picked country (TIN is NG-only).
   */
  products?: string[];
  /** Require the visitor to also type the registered business name. */
  requireRegistrationName?: boolean;
  /** Collect the company profile (address / email / phone / website) on the
   *  business-details step. Default ON; false hides the whole section. */
  collectCompanyInfo?: boolean;
  /** Per-field mode: absent = 'optional'; 'required' blocks Continue without
   *  it; 'off' hides the field. */
  companyInfo?: Partial<Record<CompanyInfoField, CompanyInfoMode>>;
  /** Key-people (director/owner) verification configuration. */
  keyPeople?: WorkflowKeyPeopleConfig;
  /** Supporting-document collection (business-documents step). */
  documents?: WorkflowBusinessDocumentsConfig;
  /** Applicant (submitter) identity verification (in-flow individual KYC). */
  applicant?: WorkflowBusinessApplicantConfig;
}

/** One requested document slot on a KYB workflow's `documents` block. */
export interface WorkflowBusinessDocumentTypeConfig {
  key: BusinessDocumentKey;
  /** Display label override (defaults per key, e.g. "Certificate of incorporation"). */
  label?: string;
  /** Submission is blocked (422 missing_documents) until this slot is uploaded. */
  required?: boolean;
}

/**
 * Supporting-document collection block on a KYB workflow. `enabled` with
 * absent/empty `types` defaults to just a required incorporation certificate.
 */
export interface WorkflowBusinessDocumentsConfig {
  enabled?: boolean;
  types?: WorkflowBusinessDocumentTypeConfig[];
}

/**
 * Applicant-verification block on a KYB workflow: when `verification` is true
 * the applicant verifies their OWN identity in-flow (role declaration + the
 * ordinary individual capture steps), linked back to the application via
 * `metadata.userId = applicantKeyPersonId` on the second submission.
 */
export interface WorkflowBusinessApplicantConfig {
  verification?: boolean;
}
