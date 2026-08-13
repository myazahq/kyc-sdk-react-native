import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  GlassView,
  isLiquidGlassAvailable,
  type GlassColorScheme,
  type GlassStyle,
} from 'expo-glass-effect';

import { useTheme } from '../runtime';

// ---------------------------------------------------------------------------
// GlassSurface — the single switch point for iOS 26 Liquid Glass.
//
// On iOS 26+ (where `isLiquidGlassAvailable()` is true) it renders a native
// `GlassView`; everywhere else (Android, iOS < 26) it falls back to a plain
// token-styled surface. Glass is purely additive — every screen looks correct
// without it.
//
// Where it is used, and the rule behind that: glass is for things that FLOAT
// above content — surfaces (the sheet shell + header, bottom sheets via
// `GlassSheet`) and interactive chrome (the header icon buttons, the camera
// controls via `ChromeGlass`).
//
// Deliberately NOT used for:
//   • the primary CTA — it needs a solid brand fill to read as the one clear
//     action, and a translucent one competes with everything behind it;
//   • labels and status pills (the brand bar, capture hints, the sandbox
//     strip) — at capsule scale glass reads as a control, so wrapping static
//     text in it promises a tap that does nothing;
//   • any "on" state (torch lit, toggle active) — a material that samples
//     what is behind it cannot state a binary unambiguously.
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
  /**
   * Forces the glass to render light or dark, overriding the app theme.
   *
   * Chrome that floats over the CAMERA needs this: its glyphs are white against
   * a live scene, not against the app's background, so following a light app
   * theme would render pale glass under white icons.
   */
  colorScheme?: GlassColorScheme;
}

export function GlassSurface({
  children,
  style,
  glassStyle = 'regular',
  tintColor,
  interactive = false,
  fallbackColor,
  colorScheme,
}: GlassSurfaceProps): React.ReactElement {
  const { colors, mode } = useTheme();

  if (liquidGlass) {
    return (
      <GlassView
        style={style}
        glassEffectStyle={glassStyle}
        tintColor={tintColor}
        isInteractive={interactive}
        colorScheme={colorScheme ?? mode}
      >
        {children}
      </GlassView>
    );
  }

  return <View style={[{ backgroundColor: fallbackColor ?? colors.backgroundSecondary }, style]}>{children}</View>;
}
