import React from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';

import { radius } from '../../config/theme';
import { useTheme } from '../../components/runtime';

// The entrance thumbnails on the review card (200-line split from
// AddressReviewStep). Web's exact geometry, so the three cards are one card:
//   hero h-28 (112) rounded-2xl shadow-xl at -bottom-10 right-4
//   second h-20 (80) rounded-xl shadow-lg at right-36 (144)
// Both share one bottom edge, 40 below the map. Flutter draws the same.

export const HERO = 112;
export const SECOND = 80;
export const OVERHANG = 40;

export function ReviewEntranceThumb({
  source,
  label,
  size,
  right,
  onFailed,
}: {
  source: ImageSourcePropType;
  label: string;
  size: number;
  right: number;
  onFailed: (error: unknown) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  // The hero wears the card's radius (16), the smaller one a step down (12).
  const r = size === HERO ? radius.md : radius.sm;
  return (
    // The shadow lives on a wrapper with a background of its own: an Image
    // cannot cast one on Android, and iOS needs an opaque shape to draw it
    // from. zIndex 20, as web spells it, so the half hanging over the band is
    // not covered by it.
    <View
      style={{
        position: 'absolute',
        zIndex: 20,
        right,
        bottom: -OVERHANG,
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: colors.background,
        shadowColor: colors.textDark,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Image
        source={source}
        accessibilityLabel={label}
        onError={(e) => onFailed(e.nativeEvent?.error)}
        style={{ width: size, height: size, borderRadius: r, borderWidth: 4, borderColor: colors.background }}
        resizeMode="cover"
      />
    </View>
  );
}
