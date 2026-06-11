import React from 'react';
import { Pressable, View } from 'react-native';

import { radius } from '../config/theme';
import { useTheme } from './runtime';
import { Icon, type IconName } from './Icon';
import { GlassSurface, supportsLiquidGlass } from './glass/GlassSurface';

// Circular icon button for the header chrome (back / theme toggle / close).
// On iOS 26 it renders as an interactive Liquid Glass circle; elsewhere it's a
// borderless ghost icon with a generous tap target. This is where the user
// asked for Liquid Glass — the theme/close/back chrome icons.

export interface GlassIconButtonProps {
  icon: IconName;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  disabled?: boolean;
  /** Render the glyph solid/filled (e.g. the theme toggle). */
  solid?: boolean;
  /**
   * Skip this button's own glass surface — used when it sits inside a
   * {@link GlassGroup} that already provides one shared glass capsule, so the
   * group reads as a single piece of glass rather than two overlapping ones.
   */
  plain?: boolean;
  /** Accessible label for screen readers. */
  accessibilityLabel?: string;
}

export function GlassIconButton({
  icon,
  onPress,
  size = 40,
  iconSize = 20,
  disabled = false,
  solid = false,
  plain = false,
  accessibilityLabel,
}: GlassIconButtonProps): React.ReactElement {
  const { colors } = useTheme();
  const enabled = !disabled && !!onPress;
  const iconColor = enabled ? `${colors.textDark}CC` : colors.textMuted; // ~0.8 alpha

  const glyph = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Icon name={icon} size={iconSize} color={iconColor} solid={solid} />
    </View>
  );

  const content =
    !plain && supportsLiquidGlass() && enabled ? (
      <GlassSurface
        glassStyle="regular"
        interactive
        style={{
          width: size,
          height: size,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={iconSize} color={iconColor} solid={solid} />
      </GlassSurface>
    ) : (
      glyph
    );

  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] })}
    >
      {content}
    </Pressable>
  );
}
