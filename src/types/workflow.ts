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

export type PoaDocumentType =
  | 'utility_bill'
  | 'bank_statement'
  | 'tenancy_agreement'
  | 'government_document'
  | 'other';

/** Whether the applicant's name must appear on the document — judged by the
 *  server; read here only to word the step. */
export type PoaNameRule = 'required' | 'optional' | 'off';

/**
 * One requested supporting document. There is no catalogue: the organisation
 * names its own, so the SDK renders the title and guidance the workflow sent.
 */
export interface SupportingDocumentRequest {
  /** The organisation's own slug — the wire `type` this upload submits as. */
  key: string;
  /** The title the applicant reads. A document without one is not asked for. */
  label?: string;
  /** Guidance under the slot: which document, and what it has to show. */
  description?: string;
  /** Server-side only: what the document is corroborated against. */
  checks?: Array<'id_number' | 'name'>;
  /**
   * The named values the server will read off it. The SDK reads the NAMES
   * alone, to tell the applicant what the document is being taken for; the
   * reading itself is entirely server-side.
   */
  fields?: Array<{ key: string; label?: string }>;
  required?: boolean;
  /** Which verified IDs it is asked for, as "CC/idType". Absent = every ID. */
  idTypes?: string[];
  /**
   * Offer it on every flow, whatever ID was verified, so `idTypes` decides only
   * who MUST provide it rather than who sees the slot. Absent = the scope hides
   * it from everybody else, which is the default.
   */
  alwaysAsk?: boolean;
}

export interface SupportingDocumentsConfig {
  enabled?: boolean;
  types?: SupportingDocumentRequest[];
  /** Server-side only. */
  retentionDays?: number;
  /** Server-side only. */
  returnedData?: string[];
}

export interface ProofOfAddressConfig {
  /** Adds the Proof of Address step (after capture, before the questionnaire). */
  enabled?: boolean;
  /** Accepted document kinds (absent = all). */
  documentTypes?: PoaDocumentType[];
  /** Custom label for the 'other' kind (absent = "Other document"). */
  otherLabel?: string;
  /** Recency window the server checks the document date against (default 90). */
  maxAgeDays?: number;
  /**
   * The org's accepted countries (absent/empty = all). On the ADDRESS SCOPE
   * this is exactly what the declared-country picker offers; on a full flow it
   * gates the step client-side (the server stays soft).
   */
  countries?: string[];
  /**
   * Per-country document-kind overrides (ISO-2 → kinds). A present entry
   * REPLACES `documentTypes` for that country.
   */
  countryDocuments?: Record<string, PoaDocumentType[]>;
  /** The default name rule for every country and kind (absent = required). */
  nameMatch?: PoaNameRule;
  /** Per-country, per-kind exceptions to `nameMatch` (ISO-2 → kind → rule). */
  countryNameMatch?: Record<string, Partial<Record<PoaDocumentType, PoaNameRule>>>;
}

// ── Address Intelligence (smart-address capture) ────────────────────────────

export interface AddressCollectionConfig {
  /** Adds the address-collection step (after Proof of Address; on KYB flows it
   *  collects the business premises pin). */
  enabled?: boolean;
  /** Block Continue without a confirmed pin (the server 422s without one too). */
  requirePin?: boolean;
  /** Whether the door-photo input is offered/required (default optional). */
  photo?: 'off' | 'optional' | 'required';
  /** Whether the directions field is offered/required (default optional). */
  directions?: 'off' | 'optional' | 'required';
  /**
   * The GROUP default for the typed details-sheet fields: `'off'` hides them
   * all, `'optional'` (the default) offers them, `'required'` requires the
   * house or flat NUMBER (the building name stays optional). Resolved per
   * field by lib/address-field-modes.ts, the mirror of the server's rule; the
   * pin step holds Continue and the review holds Confirm until every required
   * field shows a value, because the server 422s a submission that arrives
   * without one.
   */
  propertyFields?: 'off' | 'optional' | 'required';
  /**
   * Per-field overrides on the group default, keyed by the typed field
   * (`propertyName`, `propertyNumber`, `street`, `unit`, `neighbourhood`,
   * `city`, `state`, `postcode`). A `'required'` field the applicant leaves on
   * its map prefill is submitted as displayed: they saw it and confirmed by
   * continuing.
   */
  fields?: Partial<
    Record<
      'propertyName' | 'propertyNumber' | 'street' | 'unit' | 'neighbourhood' | 'city' | 'state' | 'postcode',
      'off' | 'optional' | 'required'
    >
  >;
  /**
   * Street View entrance framing. Default 'optional' (on wherever coverage
   * exists, with the photo as the fallback); 'required' is a client-UX gate
   * that removes the Skip affordance while coverage exists — no-coverage
   * still falls back to the photo, and the server never refuses over it.
   *
   * Offered on mobile through the hosted /embed/street-view page in a
   * WebView on the app grant, the way the framed map is (needs the server's
   * maps frame URL and the optional `react-native-webview` peer); without
   * either the entrance step is photo-only. See addressFlowOptions.
   */
  streetView?: 'off' | 'optional' | 'required';
  /**
   * Take a one-shot device GPS fix when the pin is confirmed, so the server
   * can judge "captured at the claimed address" (the `attested` tier). The fix
   * is a CLAIM the server evaluates, never a verdict.
   */
  attestPresence?: boolean;
  /**
   * Phase 2: multi-day presence verification. When enabled, the SDK stores the
   * confirmed pin ON-DEVICE so later `reportAddressPresence()` calls can
   * evaluate the fence locally — coordinates never leave the phone after
   * capture. `background` is reserved for the org-opt-in OS-geofence tier.
   */
  presence?: {
    enabled?: boolean;
    windowDays?: number;
    minNights?: number;
    minDays?: number;
    dwellFloorMinutes?: number;
    background?: boolean;
    /** OkHi-style always-on monitoring: the server renews each
     *  resolved cycle, and the on-device pin never self-expires. */
    alwaysOn?: boolean;
  };
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
