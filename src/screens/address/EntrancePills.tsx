import React from 'react';
import { Pressable } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { Icon, type IconName } from '../../components/Icon';
import { MyazaText } from '../../components/Typography';

// The pills that sit over a picked entrance photo (200-line split from
// EntranceDropzone). Web's `bg-background/90 shadow` surface, drawn the same
// on Flutter.

/** Web's overlay pill surface: `bg-background/90 shadow`. */
export function pillSurface(background: string, ink: string) {
  return {
    backgroundColor: `${background}E6`,
    shadowColor: ink,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  } as const;
}

/** Web's `px-3 py-1.5 text-xs font-medium` pill with a 14px icon. */
export function OverlayPill({
  icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.sm + 4,
        paddingVertical: 6,
        borderRadius: radius.full,
        ...pillSurface(colors.background, colors.textDark),
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon name={icon} size={14} color={colors.textDark} />
      <MyazaText variant="bodySmall" style={{ fontWeight: '500' }}>
        {label}
      </MyazaText>
    </Pressable>
  );
}
