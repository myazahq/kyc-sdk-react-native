import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../runtime';
import { GlassSurface } from './GlassSurface';

// ---------------------------------------------------------------------------
// GlassSheet — the panel of a bottom sheet that floats above the flow.
//
// A sheet is a surface, not a control, which is the one case where glass is
// right for something non-interactive: it is a layer that has risen above the
// content, and letting that content show through is what says so.
//
// `glassStyle: 'regular'` rather than `'clear'` on purpose. These panels are
// full of list text that has to stay readable, and `regular` is the frosted
// variant; `clear` is for chrome over imagery, where there is little to read.
//
// The colour scheme follows the APP theme (unlike the camera chrome, which is
// pinned dark) because a sheet sits over the SDK's own background, so its text
// is themed text on a themed surface.
//
// Off iOS 26 it is the opaque themed panel it has always been.
// ---------------------------------------------------------------------------

export interface GlassSheetProps {
  children?: React.ReactNode;
  /** Panel geometry — corner radii and padding. */
  style?: StyleProp<ViewStyle>;
}

export function GlassSheet({ children, style }: GlassSheetProps): React.ReactElement {
  const { colors, mode } = useTheme();
  return (
    <GlassSurface glassStyle="regular" fallbackColor={colors.background} style={style}>
      {/* A WHISPER of scrim between the glass and the content — the sheet
          must stay glass (the flow showing through is the point). This only
          takes the edge off a strongly tinted flow so body text keeps
          contrast; anything critical sits on its own alert panel besides.
          Slightly heavier in light mode, where the wash was worst. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.background, opacity: mode === 'light' ? 0.35 : 0.18 },
        ]}
      />
      {children}
    </GlassSurface>
  );
}
