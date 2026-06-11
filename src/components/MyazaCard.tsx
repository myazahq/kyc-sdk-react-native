import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { GlassSurface, supportsLiquidGlass } from './glass/GlassSurface';

// Branded card. Tappable + selectable (selection draws a brand border + tint).
// On iOS 26 the surface is Liquid Glass; otherwise a token-filled panel.

export interface MyazaCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MyazaCard({ children, onPress, selected = false, style }: MyazaCardProps): React.ReactElement {
  const { colors } = useTheme();

  const container: ViewStyle = {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: selected ? colors.primary : colors.border,
    overflow: 'hidden',
  };

  const selectedTint: ViewStyle = selected ? { backgroundColor: colors.primary100 } : {};

  const inner = supportsLiquidGlass() ? (
    <GlassSurface glassStyle="regular" style={[container, selectedTint]} tintColor={selected ? colors.primary : undefined}>
      {children}
    </GlassSurface>
  ) : (
    <View style={[container, { backgroundColor: selected ? colors.primary100 : colors.backgroundSecondary }]}>
      {children}
    </View>
  );

  if (!onPress) return <View style={style}>{inner}</View>;

  return (
    <Pressable onPress={onPress} style={style}>
      {inner}
    </Pressable>
  );
}
