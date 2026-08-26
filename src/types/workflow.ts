// ---------------------------------------------------------------------------
// Workflow-driven configuration blocks.
//
// These are the parts of the flow an org authors in the dashboard's workflow
// builder rather than in consumer code: extra steps (contact OTP, proof of
// address, questionnaire, NFC), the KYB subject, and multi-region. They arrive
// either as props or from `GET /api/kyc/workflows/:id`, and the flow always
// wins over props (see `mergeWorkflowConfig`).
//
// Shapes mirror the web SDK's `types/config.ts` + `types/business.ts` exactly —
// they are the server's published contract, so the three SDKs must not drift.
// ---------------------------------------------------------------------------

// ── Proof of Address ────────────────────────────────────────────────────────

export type PoaDocumentType = 'utility_bill' | 'bank_statement' | 'tenancy_agreement' | 'other';

export interface ProofOfAddressConfig {
  /** Adds the Proof of Address step (after capture, before the questionnaire). */
  enabled?: boolean;
  /** Accepted document kinds (absent = all). */
  documentTypes?: PoaDocumentType[];
  /** Custom label for the 'other' kind (absent = "Other document"). */
  otherLabel?: string;
  /** Recency window the server checks the document date against (default 90). */
  maxAgeDays?: number;
}

// ── NFC chip read (eMRTD) ───────────────────────────────────────────────────

export interface NfcConfig {
  /** Adds the chip-read step. */
  enabled?: boolean;
  /** Which chip-capable IDs run it, as "CC/idType" keys (absent = all). */
  idTypes?: string[];
  /**
   * Show a manual skip so someone who can't complete the read can proceed.
   * Devices with no NFC radio auto-skip regardless — this is the escape hatch
   * on NFC-capable phones.
   */
  allowSkip?: boolean;
  /** Match the selfie against the authenticated chip portrait (default on). */
  facialMatch?: boolean;
}

// ── Contact verification (email / phone OTP) ────────────────────────────────

/** Which code field the SDK renders — the org picks this in the builder. */
export type OtpInputStyle = 'segmented' | 'text';

export interface EmailVerificationConfig {
  /** Adds the email OTP step (right after consent). */
  enabled?: boolean;
  /**
   * Whether a verified email is required to proceed (default true when
   * enabled). `false` shows a "skip for now" affordance and the server accepts
   * a submission without the proof.
   */
  required?: boolean;
  /** Digits in the code (4–8; default 6). Drives the OTP-input slots. */
  codeLength?: number;
  /** Wrong entries allowed per code before it's dead (1–5; default 3). */
  maxAttempts?: number;
  inputStyle?: OtpInputStyle;
}

export interface PhoneVerificationConfig {
  /** Adds the phone OTP step (after consent / email verification). */
  enabled?: boolean;
  required?: boolean;
  codeLength?: number;
  maxAttempts?: number;
  inputStyle?: OtpInputStyle;
  /** Offered delivery channels (default ['sms']). */
  channels?: Array<'sms' | 'whatsapp'>;
  /** Default dial-code country (falls back to the flow's country). */
  defaultCountry?: string;
}

// ── Questionnaire (compliance declarations) ─────────────────────────────────

export interface QuestionnaireFieldOption {
  value: string;
  label: string;
  /**
   * Marks a choice that is not an answer on its own — an "Other". Selecting it
   * reveals a required free-text input, stored as the `<key>_other` companion
   * answer (the same shape as a money field's `<key>_currency`).
   */
  requiresDetail?: boolean;
  /** Label for the detail input (default "Please specify"). */
  detailLabel?: string;
  /** Placeholder for the detail input (default `Tell us more about "<label>"`). */
  detailPlaceholder?: string;
}

export interface QuestionnaireField {
  /** Stable snake_case key — also the webhook/decisioning field name. */
  key: string;
  label: string;
  /**
   * 'money' = amount + currency. The answer stores `<key>` (number, 2dp) and a
   * `<key>_currency` companion (ISO code).
   */
  type: 'text' | 'number' | 'money' | 'select' | 'multiselect' | 'boolean' | 'date';
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: QuestionnaireFieldOption[];
  min?: number;
  max?: number;
  /** money only: allowed ISO currency codes; the first is the default. */
  currencies?: string[];
}

export interface QuestionnaireConfig {
  /**
   * Off switch for the step. Omitted/true = shown; false = skipped even though
   * the questions remain configured (the builder's Questionnaire toggle).
   */
  enabled?: boolean;
  title?: string;
  description?: string;
  fields: QuestionnaireField[];
}

export type QuestionnaireAnswerValue = string | number | boolean | string[];

// ── Multi-region ────────────────────────────────────────────────────────────

export interface WorkflowIdOption {
  govDbCheck?: boolean;
  documentIntelligence?: boolean;
  facialMatch?: boolean;
}

export interface WorkflowCountry {
  /** ISO-3166 alpha-2. */
  country: string;
  /** Offered IDs for this country (absent/empty = every granted ID). */
  idTypes?: string[];
  /** Per-ID validation toggles — restrict-only; they never widen a grant. */
  idOptions?: Record<string, WorkflowIdOption>;
  /** Multi-ID: which IDs THIS country offers for each verification in the run.
   *  A pinned slot keeps its list; an absent entry offers everything. */
  multiIdSlots?: Array<{ idTypes?: string[] }>;
  govDbCheck?: boolean;
  documentIntelligence?: boolean;
}

// ── Liveness ────────────────────────────────────────────────────────────────

/**
 * Multi-ID: several ID checks in ONE run, one selfie, one verification. The
 * POLICY is workflow-level; WHICH IDs each verification offers is per country
 * (`WorkflowCountry.multiIdSlots`), so multi-region flows work.
 */
export interface MultiIdConfig {
  /** How many IDs the applicant completes (2–3). */
  count: number;
  /** How many must pass for the verification to be VERIFIED. */
  minPassed: number;
}

/** Gestures (default), screen-reflection flash, or both. */
export type LivenessMode = 'gestures' | 'flash' | 'both';
