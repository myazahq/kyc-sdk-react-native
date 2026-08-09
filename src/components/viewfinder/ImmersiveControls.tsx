import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../runtime';
import { MyazaText } from '../Typography';
import { Icon } from '../Icon';
import { CountryFlag } from '../CountryFlag';

// ---------------------------------------------------------------------------
// Immersive capture chrome — 1:1 with the Flutter SDK's full-screen camera.
//
// Positions are deliberate and differ from the framed viewfinder:
//   • the HINT sits at the BOTTOM, near the shutter the user is about to press,
//     not at the top where it competes with the document itself;
//   • the TORCH is bottom-right, in thumb reach on a phone held two-handed;
//   • the side badge and document pill sit top, out of the frame's way.
// ---------------------------------------------------------------------------

const SCRIM = 'rgba(0,0,0,0.55)';

/** Round translucent control — back, torch. */
export function RoundControl({
  icon,
  label,
  onPress,
  active,
  size = 48,
  style,
}: {
  icon: 'back' | 'lightbulb';
  label: string;
  onPress: () => void;
  active?: boolean;
  size?: number;
  style: object;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: active ? colors.primary : SCRIM,
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <Icon name={icon} size={20} color="#FFFFFF" />
    </Pressable>
  );
}

/** "FRONT" / "BACK" — which face of the document is expected right now. */
export function SideBadge({ side, top }: { side: 'front' | 'back'; top: number }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top,
        right: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: radius.full,
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
    >
      <MyazaText variant="bodySmall" color="#FFFFFF" style={{ fontWeight: '800', letterSpacing: 0.8 }}>
        {side === 'back' ? 'BACK' : 'FRONT'}
      </MyazaText>
    </View>
  );
}

/** Flag + document name, so the user can see WHICH document is expected. */
export function DocumentPill({
  country,
  label,
  top,
}: {
  country: string;
  label: string;
  top: number;
}): React.ReactElement {
  return (
    <View style={{ position: 'absolute', top, left: 0, right: 0, alignItems: 'center' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: SCRIM,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.18)',
          paddingHorizontal: 12,
          paddingVertical: 7,
          maxWidth: '80%',
        }}
      >
        {/* The flag carries the country on its own — a name beside it is the
            same fact twice, and it reads faster at a glance than text. */}
        {country ? (
          <>
            <CountryFlag country={country} size={26} />
            <View style={{ width: 9 }} />
          </>
        ) : null}
        <MyazaText
          variant="bodyMedium"
          color="#FFFFFF"
          numberOfLines={1}
          style={{ fontWeight: '700', flexShrink: 1 }}
        >
          {label}
        </MyazaText>
      </View>
    </View>
  );
}
