import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
// Raw flag SVG strings — the SAME source the web SDK uses (`country-flag-icons`),
// so the flags match. The WHOLE set is imported, not a curated subset: Global
// Documents let a workflow offer any ISO country, and a picker where some rows
// have a flag and others fall back to a grey box looks broken rather than
// incomplete. The strings are small and the bundler tree-shakes nothing here
// anyway, since the lookup is by runtime code.
import * as Flags from 'country-flag-icons/string/3x2';

import { radius } from '../config/theme';

// Circular country flag — the RN mirror of the web SDK's `CountryFlag` and
// Flutter's `MyazaCountryFlag`. Renders the country-flag-icons 3:2 SVG via
// react-native-svg, cropped to a circle (cover-fit, like the web SDK's
// `object-cover` + `rounded-full`). Works identically on iOS and Android (no
// emoji-flag dependency, which Android does not render).

const FLAGS = Flags as unknown as Record<string, string | undefined>;

export interface CountryFlagProps {
  /** Any ISO-3166 alpha-2 code. */
  country?: string | null;
  size?: number;
}

export function CountryFlag({ country, size = 20 }: CountryFlagProps): React.ReactElement | null {
  if (!country) return null;
  const xml = FLAGS[country.toUpperCase()];
  if (!xml) return null;

  // The flag is 3:2; to cover a square circle we render it wider than the circle
  // and let the circular clip crop the sides (matches the web's object-cover).
  const flagWidth = size * 1.5;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SvgXml xml={xml} width={flagWidth} height={size} preserveAspectRatio="xMidYMid slice" />
    </View>
  );
}
