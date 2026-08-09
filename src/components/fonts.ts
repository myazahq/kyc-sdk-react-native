import { useFonts } from 'expo-font';
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Karla_400Regular, Karla_500Medium, Karla_600SemiBold, Karla_700Bold } from '@expo-google-fonts/karla';
export { fontFamilyFor, markFamilyName, brandFamilyName, BRAND_WEIGHTS } from '../config/font-resolve';


// Typography fonts — the SAME families the Flutter SDK uses via google_fonts:
// Space Grotesk for headings, Karla for body. Loaded at runtime through
// expo-font (already natively linked), so no native rebuild is needed. Each
// weight is its own RN font family, so we resolve family-by-weight below.

export const MYAZA_FONTS = {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  Karla_400Regular,
  Karla_500Medium,
  Karla_600SemiBold,
  Karla_700Bold,
};

/** Loads the Myaza fonts. Returns true once they're ready (system font until then). */
export function useMyazaFonts(): boolean {
  const [loaded] = useFonts(MYAZA_FONTS);
  return loaded;
}

/**
 * Resolves the concrete RN font family for a (heading vs body, weight) pair.
 * Returns `undefined` until fonts are loaded so text falls back to the system
 * font + `fontWeight` without triggering an "unrecognized font" warning.
 */
