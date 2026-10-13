import type { TextStyle } from 'react-native';
import { useFonts } from 'expo-font';
import { fontFamilyFor } from '../config/font-resolve';
import { useTheme } from './theme-provider';

export { fontFamilyFor, markFamilyName, brandFamilyName, BRAND_WEIGHTS } from '../config/font-resolve';

// Typography fonts — the SAME families the Flutter SDK uses via google_fonts:
// Bricolage Grotesque for headings, Geist for body. Loaded at runtime through
// expo-font (already natively linked), so no native rebuild is needed. Each
// weight is its own RN font family, so we resolve family-by-weight below.
//
// The files are VENDORED under src/assets/fonts and required one by one (see
// the README there). They used to be named imports from the
// @expo-google-fonts packages, whose index requires EVERY weight the family
// ships — and Metro bundles every `require` it can see, used or not — so 19
// font files reached every integrator's app for the faces the SDK draws with. Measured at 1.85 MB on a real integrator's release APK.
export const MYAZA_FONTS = {
  BricolageGrotesque_400Regular: require('../assets/fonts/BricolageGrotesque_400Regular.ttf'),
  BricolageGrotesque_500Medium: require('../assets/fonts/BricolageGrotesque_500Medium.ttf'),
  BricolageGrotesque_600SemiBold: require('../assets/fonts/BricolageGrotesque_600SemiBold.ttf'),
  BricolageGrotesque_700Bold: require('../assets/fonts/BricolageGrotesque_700Bold.ttf'),
  Geist_400Regular: require('../assets/fonts/Geist_400Regular.ttf'),
  Geist_500Medium: require('../assets/fonts/Geist_500Medium.ttf'),
  Geist_600SemiBold: require('../assets/fonts/Geist_600SemiBold.ttf'),
  Geist_700Bold: require('../assets/fonts/Geist_700Bold.ttf'),
};

/** Loads the Myaza fonts. Returns true once they're ready (system font until then). */
export function useUiFonts(): boolean {
  const [loaded] = useFonts(MYAZA_FONTS);
  return loaded;
}

/**
 * The body font family for a TEXT INPUT, at the given weight.
 *
 * `TextInput` does not inherit `fontFamily` from any ancestor the way web
 * inputs inherit from a stylesheet — RN resolves it per-element — so an input
 * that never sets one renders in the system face while every `UiText`
 * beside it renders in the brand's. The placeholder follows the input's own
 * family too, which is why it looked wrong as well.
 *
 * Goes through the same resolver as UiText so an org's uploaded brand font
 * reaches inputs, not just text. Returns undefined until fonts load, which is
 * the caller's cue to leave `fontFamily` unset rather than name a family the
 * platform has not registered.
 */
export function useInputFontFamily(weight: TextStyle['fontWeight'] = '400'): string | undefined {
  const { fontsLoaded, brandFonts } = useTheme();
  return fontFamilyFor(false, weight, fontsLoaded, brandFonts);
}
