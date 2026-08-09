// ---------------------------------------------------------------------------
// Presentation: branding, the copy an org can override, and voice guidance.
//
// Split from config.ts (200-line rule). These are the parts of the flow an org
// makes its own — colours, logo, the words on the consent and success screens —
// as opposed to what it VERIFIES, which lives in workflow.ts and business.ts.
// ---------------------------------------------------------------------------

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
  /**
   * Corner radius in px for buttons, inputs and cards — the whole scale derives
   * from it, so 0 squares the flow off and 20 softens it. Circular elements
   * (avatars, the camera frame) are never affected. Default 12.
   */
  borderRadius?: number;
  /**
   * Body font family.
   *
   * Unlike the web SDK this does NOT fetch the font: React Native renders from
   * families registered by the HOST APP (the SDK's own Karla / Space Grotesk
   * ship as bundled assets). Pass a family your app has loaded; an unknown name
   * falls back to the SDK default rather than rendering nothing.
   */
  fontFamily?: string;
  /** Heading font family. Falls back to {@link fontFamily} when only that is set. */
  headingFontFamily?: string;
  /**
   * Colour overrides applied only in DARK mode.
   *
   * The colours above are the LIGHT palette. Without this block a branded flow
   * keeps its light background after the theme toggle — the appearance is
   * applied on top of whichever base scheme is active, so an org's light
   * background simply overwrote the dark one.
   */
  dark?: Pick<
    KYCAppearance,
    | 'primaryColor'
    | 'primaryTextColor'
    | 'accentColor'
    | 'backgroundColor'
    | 'surfaceColor'
    | 'borderColor'
    | 'textColor'
  >;
  companyName?: string;
  /**
   * Logo to show in the flow.
   * - An image URL renders that logo.
   * - The literal `'default'` renders the org's own logo from the server config
   *   response (falls back to the built-in shield if the org has none set).
   * - Omitted renders the built-in shield badge.
   */
  logo?: string;
  /** Initial mode. 'system' follows the device's colour scheme (live, until
   *  the in-flow theme toggle picks one); applied on mount. */
  theme?: 'light' | 'dark' | 'system';
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
