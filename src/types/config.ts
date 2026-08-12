// ---------------------------------------------------------------------------
// The SDK's public configuration.
//
// The country/ID matrix, the presentation types and the workflow-driven blocks
// live in their own modules (200-line rule) and are re-exported here, so
// `types/config` remains the single import for consumers.
// ---------------------------------------------------------------------------

import type { KYCSubmission, KYCError } from './verification';
import type { IdType, IdTypeForCountry, SupportedCountry } from './id-types';
import type {
  KYCAppearance,
  KYCConsentContent,
  KYCSuccessContent,
  VoiceGuidanceOption,
} from './appearance';
import type { SubjectType, WorkflowBusinessConfig } from './business';
import type {
  EmailVerificationConfig,
  LivenessMode,
  NfcConfig,
  PhoneVerificationConfig,
  ProofOfAddressConfig,
  QuestionnaireConfig,
  WorkflowCountry,
} from './workflow';

export type * from './workflow';
export type * from './appearance';
export type * from './id-types';
export type * from './business';

// ---------------------------------------------------------------------------
// KYC flow steps
// ---------------------------------------------------------------------------

export type KYCStep =
  | 'consent'
  // Contact-verification OTP steps — right after consent (a cheap pre-filter
  // before capture/registry spend). Present when the workflow enables them.
  | 'email-verification'
  | 'phone-verification'
  | 'country-select'
  | 'id-type'
  | 'id-input'
  | 'document-capture'
  // eMRTD chip read — a real step here, unlike the web SDK where it exists only
  // as a builder-preview screen (Web NFC can't do ISO-DEP).
  | 'nfc'
  // KYB application steps — present only when the workflow configures them.
  | 'business-details'
  | 'business-key-people'
  | 'business-documents'
  | 'applicant-role'
  | 'liveness'
  | 'proof-of-address'
  | 'questionnaire'
  | 'submitted';

// ---------------------------------------------------------------------------
// Client-side SDK config  (MyazaKYC.show() / useMyazaKYC options)
// ---------------------------------------------------------------------------

/** How flow progress is drawn — see {@link MyazaKYCConfig.progressStyle}. */
export type ProgressStyle = 'steps' | 'bar';

export interface MyazaKYCConfig<C extends SupportedCountry = SupportedCountry> {
  /**
   * Bearer token. The key prefix is the single source of truth for the
   * environment — the SDK derives it (and the base URL) automatically:
   * `pk_dev_…` → development, `pk_test_…` → sandbox, `pk_live_…` → production.
   * An unrecognized prefix throws.
   */
  apiKey: string;

  /**
   * Dev-only base-URL override. Only applied for **development** keys
   * (`pk_dev_…`); defaults to a platform-aware localhost (`10.0.2.2:3001` on
   * Android emulators, `localhost:3001` elsewhere). Ignored for sandbox /
   * production keys.
   */
  devUrl?: string;

  /**
   * A published workflow to run (`wf_…`). The flow is resolved BEFORE the SDK
   * mounts and its config wins over the props below — so an org can change the
   * flow's shape in the dashboard builder without a redeploy. Runtime data
   * (`userId`, `userData`, `metadata`, callbacks) always stays yours.
   *
   * A workflow supplies `country`, so it may be omitted alongside this.
   */
  workflowId?: string;

  /**
   * KYB only: the mapped applicant workflow's id (business.applicant.workflowId,
   * resolved server-side). Set by the workflow gate after overlaying its
   * capture template; stamped on the applicant's own submission so the server
   * applies that workflow's gates, pricing and decision graph. Internal —
   * never set this yourself.
   */
  applicantWorkflowId?: string;

  /**
   * Two-letter (ISO-2) country code. Required unless {@link workflowId} is set
   * (the flow carries the country) or {@link subjectType} is `'business'` (the
   * business block carries its own registry country). When both are present the
   * flow's country wins.
   */
  country?: C;

  /** Subset of ID types to offer. Only types valid for the country are accepted. */
  idTypes?: IdTypeForCountry<C>[];

  /**
   * The org's own reference for the person being verified (e.g. your internal
   * user id). It is **not** matched during verification — it becomes
   * `Entity.externalUserId` at the KYC seam, so repeat checks of the same user
   * collapse onto one entity and you can correlate results back to your record.
   * Optional; when omitted the server falls back to the provider record id.
   */
  userId?: string;

  /** Pre-populated user data. Fields provided here won't be collected again. */
  userData?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    /**
     * The business's display name, for `{businessName}` tokens in consent
     * copy on KYB flows. Registration details aren't collected until after
     * consent, so this resolves only when the integrator passes it in —
     * mirroring the web SDK.
     */
    businessName?: string;
  };

  /** Enable the live-selfie capture step. */
  enableSelfie?: boolean;

  /** Enable the document-photo capture step. */
  enableDocumentCapture?: boolean;

  /**
   * Allow picking a document photo from the device gallery as an alternative to
   * the live camera capture. Default `true`. When `false`, the "upload a photo
   * instead" affordances are hidden during normal capture.
   */
  allowDocumentUpload?: boolean;

  /** Enable liveness detection during selfie capture. Default `true`. */
  enableLiveness?: boolean;

  /**
   * Which liveness method runs: randomized gestures (default), the screen-
   * reflection flash, or both. Workflow-driven.
   */
  livenessMode?: LivenessMode;

  /** Colours in the flash sequence (2–5, default 4). Flash modes only. */
  flashSequenceLength?: number;

  // ── Workflow-driven blocks ────────────────────────────────────────────────
  // Authored in the dashboard's workflow builder, not usually in consumer code.
  // A resolved flow always wins over a prop of the same name.

  /** What this flow verifies. Absent = 'individual' (classic KYC). */
  subjectType?: SubjectType;

  /** KYB registry configuration. Required when `subjectType` is 'business'. */
  business?: WorkflowBusinessConfig;

  /**
   * Multi-region: every country this flow serves. More than one inserts a
   * country-select step between consent and ID type.
   */
  countries?: WorkflowCountry[];

  /** Email OTP possession check, right after consent. */
  emailVerification?: EmailVerificationConfig;

  /** Phone OTP possession check, right after consent / email. */
  phoneVerification?: PhoneVerificationConfig;

  /** Proof-of-address document check, after capture. */
  proofOfAddress?: ProofOfAddressConfig;

  /** Compliance declarations asked just before submission. */
  questionnaire?: QuestionnaireConfig;

  /** eMRTD chip read for chip-capable documents. */
  nfc?: NfcConfig;

  /** Collect device + IP fraud signals. Default `true`. */
  deviceIntelligence?: boolean;

  /** Refuse to run on a desktop/laptop. Default `false`. */
  requireMobileDevice?: boolean;

  /**
   * Spoken liveness instructions (accessibility). `true`/omitted = on,
   * `false` = off, or a {@link VoiceGuidanceConfig}. TTS output only — no
   * microphone is used. Default: on.
   */
  voiceGuidance?: VoiceGuidanceOption;

  /** Show a light/dark mode toggle button inside the modal header. Default `true`. */
  showThemeToggle?: boolean;

  /**
   * How progress through the flow is drawn in the header.
   *
   *   • `'steps'` (default) — numbered circles, one per step, connected. Shows
   *     WHICH step you are on and how many there are, and collapses to a window
   *     when they no longer fit.
   *   • `'bar'` — a single thin bar pinned to the bottom edge of the header.
   *     Quieter, and unaffected by step count, so it suits long flows and hosts
   *     who would rather the chrome said less.
   *
   * Both convey the same fraction; the choice is how much room it takes.
   */
  progressStyle?: ProgressStyle;

  /**
   * Hide the close (X) button and block all user-initiated dismissal of the
   * sheet — the X button, Android hardware back, and the iOS swipe-down drag.
   * When `true`, the flow can only be closed programmatically via the `close()`
   * returned by {@link useMyazaKYC}. Default `false`. The terminal "Submitted"
   * step is already non-dismissible regardless of this flag.
   */
  disableClose?: boolean;

  /** Visual customisation. */
  appearance?: KYCAppearance;

  /** Override the consent (welcome) screen copy. */
  consent?: KYCConsentContent;

  /** Override the success (submitted) screen copy. */
  success?: KYCSuccessContent;

  /**
   * Arbitrary, free-form metadata forwarded verbatim with every verification
   * request. Nothing here is required or interpreted by the SDK/server — use
   * {@link userId} for the user reference, not a `userId` key in here.
   */
  metadata?: Record<string, string>;

  // Callbacks
  onStart?: () => void;
  onStepChange?: (step: KYCStep) => void;
  /**
   * Fires immediately after the user submits. The submission is always
   * status: 'pending' — results arrive async via webhook.
   */
  onSubmit?: (submission: KYCSubmission) => void;
  onClose?: () => void;
  /**
   * Fires for technical errors only. Receives a {@link KYCError} carrying a
   * typed `code`. Verification *outcomes* never come through here.
   */
  onError?: (error: KYCError) => void;
}

/**
 * The config the FLOW runs on, as opposed to the config a consumer writes.
 *
 * `country` is optional on the public surface because a `workflowId` supplies
 * it — but by the time anything mounts, the workflow gate has resolved one, and
 * every screen from ID-type onward needs it. Making that guarantee a type keeps
 * the "is it there yet?" question at the single place that answers it (the
 * gate) instead of in every screen.
 */
export type ResolvedKYCConfig<C extends SupportedCountry = SupportedCountry> = Omit<
  MyazaKYCConfig<C>,
  'country'
> & { country: C };

// ---------------------------------------------------------------------------
// useMyazaKYC() hook return type
// ---------------------------------------------------------------------------

export interface UseMyazaKYCReturn {
  open: () => void;
  close: () => void;
  isOpen: boolean;
  currentStep: KYCStep | null;
}
