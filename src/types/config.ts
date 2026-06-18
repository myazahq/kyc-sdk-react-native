import type { KYCSubmission, KYCError } from './verification';

// ---------------------------------------------------------------------------
// Supported countries & ID types  (identical set to the web + Flutter SDKs)
// ---------------------------------------------------------------------------

export type SupportedCountry = 'NG' | 'GH' | 'KE' | 'ZA' | 'CI';

export type NigeriaIdType = 'bvn' | 'bvn-premium' | 'nin' | 'vnin' | 'tax-id' | 'passport' | 'drivers-license' | 'pvc';
export type GhanaIdType = 'ghana-card' | 'voters' | 'drivers-license' | 'ssnit' | 'passport';
export type KenyaIdType = 'national-id' | 'passport';
export type SouthAfricaIdType = 'national-id';
export type IvoryCoastIdType = 'cni' | 'residence-card';

export type IdType =
  | NigeriaIdType
  | GhanaIdType
  | KenyaIdType
  | SouthAfricaIdType
  | IvoryCoastIdType;

/** Maps a country code to the ID types available in that country. */
export type IdTypeForCountry<C extends SupportedCountry> =
  C extends 'NG' ? NigeriaIdType :
  C extends 'GH' ? GhanaIdType :
  C extends 'KE' ? KenyaIdType :
  C extends 'ZA' ? SouthAfricaIdType :
  C extends 'CI' ? IvoryCoastIdType :
  never;

export interface IdTypeDefinition {
  key: IdType;
  label: string;
  /**
   * What the user actually types when it differs from the ID's name — e.g.
   * Tax ID lookups are keyed off the person's NIN, so the input asks for a NIN.
   */
  inputLabel?: string;
  digits?: number;
  pattern?: RegExp;
  /** Whether this ID type requires photographing/uploading a physical document. */
  requiresDocumentCapture: boolean;
  /**
   * How many sides of the document need to be scanned. Only present when
   * `requiresDocumentCapture` is true.
   * - `front_only` — single scan (passports, data-page only)
   * - `front_and_back` — both sides required
   */
  scanSides?: 'front_only' | 'front_and_back';
}

export type IdTypesByCountry = {
  [K in SupportedCountry]: readonly IdTypeDefinition[];
};

// ---------------------------------------------------------------------------
// KYC flow steps
// ---------------------------------------------------------------------------

export type KYCStep =
  | 'consent'
  | 'id-type'
  | 'id-input'
  | 'document-capture'
  | 'liveness'
  | 'submitted';

// ---------------------------------------------------------------------------
// Appearance / theming
// ---------------------------------------------------------------------------

export interface KYCAppearance {
  /** Brand color — drives buttons, selected states, focus rings. */
  primaryColor?: string;
  /** Text/icon color rendered on top of `primaryColor` (e.g. button labels). */
  primaryTextColor?: string;
  /** Accent color for subtle hover/active surfaces. */
  accentColor?: string;
  /** Modal/sheet background color. */
  backgroundColor?: string;
  /** Elevated surface color for cards/panels. */
  surfaceColor?: string;
  /** Border + input outline color. */
  borderColor?: string;
  /** Primary text color. */
  textColor?: string;
  companyName?: string;
  /**
   * Logo to show in the flow.
   * - An image URL renders that logo.
   * - The literal `'default'` renders the org's own logo from the server config
   *   response (falls back to the built-in shield if the org has none set).
   * - Omitted renders the built-in shield badge.
   */
  logo?: string;
  /** Initial light/dark mode. Applied on mount; the theme toggle can flip it. */
  theme?: 'light' | 'dark';
}

// ---------------------------------------------------------------------------
// Consent / success screen content
// ---------------------------------------------------------------------------

export interface KYCConsentContent {
  /** Consent heading. Supports `{firstName}` / `{lastName}` tokens. */
  title?: string;
  /** Sub-text under the heading. Same tokens. */
  description?: string;
}

export interface KYCSuccessContent {
  /** Success heading. Supports `{firstName}` / `{lastName}` tokens. */
  title?: string;
  /** Sub-text under the heading. Same tokens. */
  description?: string;
}

// ---------------------------------------------------------------------------
// Voice guidance (spoken liveness instructions — TTS output only, no mic)
// ---------------------------------------------------------------------------

/**
 * Configuration for the spoken liveness instructions. TTS **output** for
 * accessibility — it never records audio, so no microphone permission is
 * involved. An object (not a bare boolean) so a `language` can be added later
 * without a breaking change.
 */
export interface VoiceGuidanceConfig {
  /** Whether spoken guidance plays. Default `true`. */
  enabled?: boolean;
  /** BCP-47 voice tag (e.g. `'en-US'`, `'fr-FR'`). Default `'en-US'`. */
  language?: string;
}

/** Accepts a bare boolean for ergonomics or the full {@link VoiceGuidanceConfig}. */
export type VoiceGuidanceOption = boolean | VoiceGuidanceConfig;

// ---------------------------------------------------------------------------
// Client-side SDK config  (MyazaKYC.show() / useMyazaKYC options)
// ---------------------------------------------------------------------------

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

  /** Two-letter country code. */
  country: C;

  /** Subset of ID types to offer. Only types valid for the country are accepted. */
  idTypes?: IdTypeForCountry<C>[];

  /** Pre-populated user data. Fields provided here won't be collected again. */
  userData?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
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
   * Spoken liveness instructions (accessibility). `true`/omitted = on,
   * `false` = off, or a {@link VoiceGuidanceConfig}. TTS output only — no
   * microphone is used. Default: on.
   */
  voiceGuidance?: VoiceGuidanceOption;

  /** Show a light/dark mode toggle button inside the modal header. Default `true`. */
  showThemeToggle?: boolean;

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

  /** Arbitrary metadata forwarded with every verification request. */
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

// ---------------------------------------------------------------------------
// useMyazaKYC() hook return type
// ---------------------------------------------------------------------------

export interface UseMyazaKYCReturn {
  open: () => void;
  close: () => void;
  isOpen: boolean;
  currentStep: KYCStep | null;
}
