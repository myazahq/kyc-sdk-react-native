// ---------------------------------------------------------------------------
// The footer attribution and what follows from it. Mirrors the web SDK's
// components/trust-attribution-resolve.ts and lib/trust-attribution.ts.
//
// The server resolves `branding.trustAttribution` from the PUBLISHED workflow:
// the Myaza Trust lockup (the default, and what an older server that sends
// nothing means), or the organisation's own logo in its place. Pure, so the
// parsing and the choices are unit-tested.
// ---------------------------------------------------------------------------

/** What the server sends. Missing (older servers) means Myaza. */
export type SdkTrustAttribution =
  | { mode: 'myaza' }
  | { mode: 'custom'; logo: string; logoDark?: string; companyName?: string };

/** Which attribution the footer draws. */
export type ResolvedTrustAttribution =
  | { mode: 'myaza' }
  | { mode: 'custom'; logo?: string; companyName?: string };

const text = (value: unknown): string | undefined =>
  (typeof value === 'string' && value.trim()) || undefined;

/**
 * Read defensively: config JSON can come from an older or mixed-version
 * server. Anything that is not `custom` is Myaza; a `custom` with a malformed
 * logo stays custom, because falling back to Myaza would put our mark on a
 * flow the org asked to carry their own. On a dark flow the org's dark-theme
 * version wins when they supplied one.
 */
export function resolveTrustAttribution(attribution: unknown, dark = false): ResolvedTrustAttribution {
  if (!attribution || typeof attribution !== 'object') return { mode: 'myaza' };
  const raw = attribution as { mode?: unknown; logo?: unknown; logoDark?: unknown; companyName?: unknown };
  if (raw.mode !== 'custom') return { mode: 'myaza' };
  const logo = (dark && text(raw.logoDark)) || text(raw.logo);
  return { mode: 'custom', logo, companyName: text(raw.companyName) };
}

/**
 * Whether the consent notice must name Myaza. When the org's own logo replaces
 * Myaza's in the footer, Myaza still processes the applicant's data, so the
 * notice keeps it disclosed with a link to its terms.
 */
export function needsMyazaDisclosure(attribution: unknown): boolean {
  return resolveTrustAttribution(attribution).mode === 'custom';
}

/**
 * The organisation Myaza provides the verification for, as the consent notice
 * names it: the name on the custom attribution, then the workflow's company
 * name, then the branding name.
 */
export function myazaProviderName(
  attribution: unknown,
  workflowCompanyName?: string,
  brandingCompanyName?: string,
): string {
  const resolved = resolveTrustAttribution(attribution);
  const custom = resolved.mode === 'custom' ? resolved.companyName : undefined;
  return (custom || workflowCompanyName || brandingCompanyName || '').trim();
}

/** The accessible name for the org's logo. */
export function customLogoLabel(companyName: string | undefined): string {
  return companyName ? `${companyName} logo` : 'Organisation logo';
}

/** The custom logo's box: the Myaza wordmark's height, the web's max-width. */
export const CUSTOM_LOGO_HEIGHT = 24;
export const CUSTOM_LOGO_MAX_WIDTH = 144;

/** The logo's width for its natural size (width auto), capped at the max. */
export function customLogoWidth(width: number | undefined, height: number | undefined): number {
  if (!width || !height) return CUSTOM_LOGO_MAX_WIDTH;
  return Math.min(CUSTOM_LOGO_MAX_WIDTH, (CUSTOM_LOGO_HEIGHT * width) / height);
}
