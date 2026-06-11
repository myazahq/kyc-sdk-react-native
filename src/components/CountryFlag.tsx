import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
// Raw flag SVG strings — the SAME source the web SDK uses (`country-flag-icons`),
// so the flags match. Only the supported countries are imported.
import NG from 'country-flag-icons/string/3x2/NG';
import GH from 'country-flag-icons/string/3x2/GH';
import KE from 'country-flag-icons/string/3x2/KE';
import ZA from 'country-flag-icons/string/3x2/ZA';
import CI from 'country-flag-icons/string/3x2/CI';

import { radius } from '../config/theme';
import type { SupportedCountry } from '../types/config';

// Circular country flag beside the step title — the RN mirror of the web SDK's
// `CountryFlag` and Flutter's `MyazaCountryFlag`. Renders the country-flag-icons
// 3:2 SVG via react-native-svg, cropped to a circle (cover-fit, like the web
// SDK's `object-cover` + `rounded-full`). Works identically on iOS and Android
// (no emoji-flag dependency, which Android doesn't render).

const FLAGS: Record<SupportedCountry, string> = { NG, GH, KE, ZA, CI };

export interface CountryFlagProps {
  country?: SupportedCountry | null;
  size?: number;
}

export function CountryFlag({ country, size = 20 }: CountryFlagProps): React.ReactElement | null {
  if (!country) return null;
  const xml = FLAGS[country];
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
