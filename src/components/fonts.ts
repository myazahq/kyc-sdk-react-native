import type { TextStyle } from 'react-native';
import { useFonts } from 'expo-font';
import { fontFamilyFor } from '../config/font-resolve';
import { useTheme } from './theme-provider';

export { fontFamilyFor, markFamilyName, brandFamilyName, BRAND_WEIGHTS } from '../config/font-resolve';

// Typography fonts — the SAME families the Flutter SDK uses via google_fonts:
// Space Grotesk for headings, Karla for body. Loaded at runtime through
// expo-font (already natively linked), so no native rebuild is needed. Each
// weight is its own RN font family, so we resolve family-by-weight below.
//
// The files are VENDORED under src/assets/fonts and required one by one (see
// the README there). They used to be named imports from the
// @expo-google-fonts packages, whose index requires EVERY weight the family
// ships — and Metro bundles every `require` it can see, used or not — so 19
// font files reached every integrator's app for the seven faces the SDK draws
// with. Measured at 1.85 MB on a real integrator's release APK.
export const MYAZA_FONTS = {
  SpaceGrotesk_500Medium: require('../assets/fonts/SpaceGrotesk_500Medium.ttf'),
  SpaceGrotesk_600SemiBold: require('../assets/fonts/SpaceGrotesk_600SemiBold.ttf'),
  SpaceGrotesk_700Bold: require('../assets/fonts/SpaceGrotesk_700Bold.ttf'),
  Karla_400Regular: require('../assets/fonts/Karla_400Regular.ttf'),
  Karla_500Medium: require('../assets/fonts/Karla_500Medium.ttf'),
  Karla_600SemiBold: require('../assets/fonts/Karla_600SemiBold.ttf'),
  Karla_700Bold: require('../assets/fonts/Karla_700Bold.ttf'),
};

/** Loads the Myaza fonts. Returns true once they're ready (system font until then). */
export function useMyazaFonts(): boolean {
  const [loaded] = useFonts(MYAZA_FONTS);
  return loaded;
}

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
