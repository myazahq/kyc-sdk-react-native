import React from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from './runtime';
import { fontFamilyFor, markFamilyName } from './fonts';

// Branded text. `variant` picks size/weight; headings render in Space Grotesk and
// body/labels in Karla — the SAME families the Flutter SDK uses (google_fonts) —
// resolved per weight by `fontFamilyFor` once expo-font has loaded them.

export type TextVariant =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'body'
  | 'bodyMedium'
  | 'bodySmall'
  | 'label'
  | 'button';

const VARIANTS: Record<TextVariant, TextStyle> = {
  heading1: { fontSize: 24, fontWeight: '700' },
  heading2: { fontSize: 20, fontWeight: '600' },
  heading3: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  bodyMedium: { fontSize: 14, fontWeight: '400' },
  bodySmall: { fontSize: 12, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '500' },
  button: { fontSize: 16, fontWeight: '600' },
};

const HEADINGS = new Set<TextVariant>(['heading1', 'heading2', 'heading3']);

export interface MyazaTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  /**
   * Render in the Myaza brand face, ignoring the org's font override.
   *
   * For the wordmark ONLY (the "TRUST" in the footer lockup). Everything else
   * in the flow is the customer's UI and should take the customer's typeface;
   * a logo is not.
   */
  brandMark?: boolean;
}

export function MyazaText({
  variant = 'body',
  color,
  style,
  brandMark = false,
  ...rest
}: MyazaTextProps): React.ReactElement {
  const { colors, fontsLoaded, brandFonts } = useTheme();
  const defaultColor =
    variant === 'bodyMedium'
      ? colors.textSecondary
      : variant === 'bodySmall'
        ? colors.textMuted
        : colors.textDark;

  // Flatten variant + caller style so an inline `fontWeight` override selects the
  // right Space Grotesk / Karla weight (custom fonts ignore `fontWeight`, so the
  // weight must be baked into the family).
  const flat = (StyleSheet.flatten([VARIANTS[variant], style]) ?? {}) as TextStyle;
  const family = brandMark
    ? markFamilyName(flat.fontWeight, fontsLoaded)
    : fontFamilyFor(HEADINGS.has(variant), flat.fontWeight, fontsLoaded, brandFonts);

  return (
    <Text
      style={[
        flat,
        { color: color ?? defaultColor },
        // EVERY resolved family — bundled or brand — encodes its weight in the
        // family name, so fontWeight must always be cleared. Leaving it makes
        // the platform synthesise a bolder face on top of an already-bold file:
        // the glyphs render wider than they were measured and the text clips.
        family ? { fontFamily: family, fontWeight: undefined } : null,
      ]}
      {...rest}
    />
  );
}
