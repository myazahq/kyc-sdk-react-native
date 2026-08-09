/**
 * Vendor brand constants for the SDK's own attribution — NOT the integrating
 * org's branding (that is `useBranding()`, driven by `/api/kyc/config`).
 *
 * The platform is **Myaza Trust**, a product of **Myaza** (the parent company).
 * Always the full product name: bare "Myaza" is the company, and a pipe
 * ("Myaza | Trust") reads as a separator between two items rather than one
 * name. See the naming rule in kyc-dashboard/CLAUDE.md.
 */
export const PRODUCT_NAME = 'Myaza Trust';

/** The product site — where "who are these people?" gets answered. */
export const PRODUCT_URL = 'https://trust.myaza.co';

/**
 * Wordmark ink. The icon keeps its brand colours in both themes; only the
 * "myaza" lettering flips. These are the exact values the dashboard's own Logo
 * renders (logo.svg / logo-white.svg), so the mark is brand-accurate rather
 * than tinted to whatever the sheet's text colour happens to be.
 */
export const WORDMARK_LIGHT = '#19156F';
export const WORDMARK_DARK = '#F6F5FE';

/**
 * End-user legal documents linked from the consent screen. These are MYAZA's
 * terms — the person consents to us processing their data as the verification
 * provider — so they are never org-overridable.
 */
export const TERMS_URL = 'https://trust.myaza.co/legal/terms';
export const PRIVACY_URL = 'https://trust.myaza.co/legal/privacy';

/**
 * Version of the consent wording. Consent is given by ACTING (tapping
 * Continue) rather than ticking a box, so bump this whenever the copy changes
 * materially and store it with the verification — otherwise nothing proves
 * which disclosure was on screen. Keep in step with the web SDK's value.
 */
export const CONSENT_VERSION = '2026-08-06.1';

/**
 * Tones the footer mark may use — the design system's INK and LIGHT text
 * colours, not the brand purple.
 *
 * Attribution, not advertising. A saturated purple mark is the loudest thing in
 * the footer on an org whose palette is yellow or green: it draws the eye to the
 * least important element on screen and reads as a clash rather than a
 * signature. Every comparable vendor mark (Stripe, Plaid, Persona) is monochrome
 * for the same reason.
 *
 * Nothing is lost by it — the logo ICON keeps its fixed brand fills, so the
 * Myaza identity is still carried by the mark itself while the text recedes.
 * These two are the design system's own text tones, so this stays on-brand
 * rather than arbitrary black-on-white.
 *
 * Mirrors the web SDK's `lib/brand.ts` — keep the list and the rule in step.
 */
const MARK_TONES = ['#070330', '#F6F5FE'] as const;

/** WCAG AA for the small text this renders at. */
const MIN_MARK_CONTRAST = 4.5;

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const channel = (i: number): number => {
    const s = parseInt(h.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The mark tone that stays legible on `background`.
 *
 * The footer mark must NOT follow the org's palette: it is our attribution, and
 * an org whose brand is close to ours would otherwise get a mark that either
 * stops reading as Myaza or disappears into the background entirely. Chosen by
 * CONTRAST rather than by light/dark, because an org can set any background —
 * including mid-tones where neither variant is obviously right.
 *
 * Falls back to the most visible tone when none clears AA, so the answer is
 * always the best available rather than a fixed guess.
 */
export function brandMarkColor(background: string): string {
  const bg = /^#[0-9a-f]{6}$/i.test(background.trim()) ? background.trim() : '#FFFFFF';
  for (const tone of MARK_TONES) {
    if (contrastRatio(tone, bg) >= MIN_MARK_CONTRAST) return tone;
  }
  return MARK_TONES.reduce((best, tone) =>
    contrastRatio(tone, bg) > contrastRatio(best, bg) ? tone : best,
  );
}
