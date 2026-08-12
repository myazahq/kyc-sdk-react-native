import type { TextStyle } from 'react-native';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Karla_400Regular, Karla_500Medium, Karla_600SemiBold, Karla_700Bold } from '@expo-google-fonts/karla';
import { fontFamilyFor } from '../config/font-resolve';
import { useTheme } from './theme-provider';

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

/**
 * The body font family for a TEXT INPUT, at the given weight.
 *
 * `TextInput` does not inherit `fontFamily` from any ancestor the way web
 * inputs inherit from a stylesheet — RN resolves it per-element — so an input
 * that never sets one renders in the system face while every `MyazaText`
 * beside it renders in the brand's. The placeholder follows the input's own
 * family too, which is why it looked wrong as well.
 *
 * Goes through the same resolver as MyazaText so an org's uploaded brand font
 * reaches inputs, not just text. Returns undefined until fonts load, which is
 * the caller's cue to leave `fontFamily` unset rather than name a family the
 * platform has not registered.
 */
export function useInputFontFamily(weight: TextStyle['fontWeight'] = '400'): string | undefined {
  const { fontsLoaded, brandFonts } = useTheme();
  return fontFamilyFor(false, weight, fontsLoaded, brandFonts);
}
