import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable, type GlassStyle } from 'expo-glass-effect';

import { useTheme } from '../runtime';

// ---------------------------------------------------------------------------
// GlassSurface — the single switch point for iOS 26 Liquid Glass.
//
// On iOS 26+ (where `isLiquidGlassAvailable()` is true) it renders a native
// `GlassView`; everywhere else (Android, iOS < 26) it falls back to a plain
// token-styled surface. Glass is purely additive — every screen looks correct
// without it. Used for the sheet shell, header, primary buttons, and ID cards.
// ---------------------------------------------------------------------------

const liquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

/** Whether the running device supports the Liquid Glass design. */
export function supportsLiquidGlass(): boolean {
  return liquidGlass;
}

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Glass intensity on capable devices. */
  glassStyle?: GlassStyle;
  /** Optional tint laid over the glass (brand color, low alpha). */
  tintColor?: string;
  /** Whether the glass reacts to touch (for interactive chrome like buttons). */
  interactive?: boolean;
  /**
   * Background color used on the NON-glass fallback path. Defaults to the
   * theme's elevated surface (`backgroundSecondary`).
   */
  fallbackColor?: string;
}

export function GlassSurface({
  children,
  style,
  glassStyle = 'regular',
  tintColor,
  interactive = false,
  fallbackColor,
}: GlassSurfaceProps): React.ReactElement {
  const { colors, mode } = useTheme();

  if (liquidGlass) {
    return (
      <GlassView
        style={style}
        glassEffectStyle={glassStyle}
        tintColor={tintColor}
        isInteractive={interactive}
        colorScheme={mode}
      >
        {children}
      </GlassView>
    );
  }

  return <View style={[{ backgroundColor: fallbackColor ?? colors.backgroundSecondary }, style]}>{children}</View>;
}
