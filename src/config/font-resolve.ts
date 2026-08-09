import type { TextStyle } from 'react-native';

/**
 * PURE font-name resolution — no expo/RN runtime imports, so it is unit
 * testable. `components/fonts.ts` owns the loading; this owns the naming.
 *
 * The invariant both sides depend on: a weight is resolved INTO the family
 * name, never left for the platform to synthesise. Synthetic bold smears
 * glyphs wider than they were measured, which clips text.
 */

/** The weights the SDK actually renders (see VARIANTS in Typography). */
export const BRAND_WEIGHTS = [400, 500, 600, 700] as const;

/** Registered family name for one weight — 400 keeps the bare name. */
export function brandFamilyName(family: string, weight: number): string {
  return weight === 400 ? family : `${family}__${weight}`;
}

/**
 * The family for the Myaza MARK itself — always the bundled Karla, never the
 * org's font.
 *
 * "TRUST" is part of a wordmark, not body copy. Rendering it in whatever
 * typeface the workflow chose redraws someone else's logo in the customer's
 * font, which is both wrong as attribution and inconsistent with the same
 * lockup on the web and in the dashboard sidebar. So this deliberately ignores
 * the brand-font override that `fontFamilyFor` honours.
 *
 * The web equivalent is `BRAND_FONT_STACK` ('"Karla", system-ui, sans-serif').
 * RN has no stack — `fontFamily` matches one registered family or nothing — so
 * an unloaded font returns undefined and the platform face stands in, which is
 * exactly what the web's `system-ui` fallback does.
 */
export function markFamilyName(
  weight: TextStyle['fontWeight'],
  loaded: boolean,
): string | undefined {
  if (!loaded) return undefined;
  const w = String(weight ?? '400');
  if (w === '700' || w === '800' || w === '900' || w === 'bold') return 'Karla_700Bold';
  if (w === '600') return 'Karla_600SemiBold';
  if (w === '500') return 'Karla_500Medium';
  return 'Karla_400Regular';
}

export function fontFamilyFor(
  isHeading: boolean,
  weight: TextStyle['fontWeight'],
  loaded: boolean,
  override?: { body?: string; heading?: string },
): string | undefined {
  const w = String(weight ?? '400');
  const bold = w === '700' || w === '800' || w === '900' || w === 'bold';

  // An org font wins. Its weights are registered as SEPARATE families (see
  // brand-font.ts), exactly like the bundled ones — so the weight is resolved
  // into the family name here and never left for the platform to synthesise.
  // Synthetic bold smears glyphs wider than they were measured, which clips
  // text; picking a real weight cannot.
  const brand = isHeading ? (override?.heading ?? override?.body) : override?.body;
  if (brand && brand.trim()) {
    const family = brand.trim();
    const target = bold ? 700 : w === '600' ? 600 : w === '500' ? 500 : 400;
    return brandFamilyName(family, target);
  }

  if (!loaded) return undefined;
  if (isHeading) {
    if (bold) return 'SpaceGrotesk_700Bold';
    if (w === '500') return 'SpaceGrotesk_500Medium';
    return 'SpaceGrotesk_600SemiBold'; // 600 default for headings
  }
  if (bold) return 'Karla_700Bold';
  if (w === '600') return 'Karla_600SemiBold';
  if (w === '500') return 'Karla_500Medium';
  return 'Karla_400Regular';
}