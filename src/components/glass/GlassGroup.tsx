import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '../../config/theme';
import { GlassSurface, supportsLiquidGlass } from './GlassSurface';

// GlassGroup — renders a set of header controls as a SINGLE Liquid Glass capsule
// on iOS 26 (one clean pill behind both icons) rather than two separate glass
// circles. The child icon buttons are passed `plain` so they don't draw their
// own glass — the capsule is the only glass surface, giving a crisp grouped look
// (like the iOS 26 navigation-bar control groups). On Android / iOS < 26 it's a
// plain transparent row.

export interface GlassGroupProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GlassGroup({ children, style }: GlassGroupProps): React.ReactElement {
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center' };

  if (supportsLiquidGlass()) {
    return (
      <GlassSurface
        glassStyle="regular"
        interactive
        style={[row, { borderRadius: radius.full, paddingHorizontal: 4 }, style]}
      >
        {children}
      </GlassSurface>
    );
  }
  return <View style={[row, style]}>{children}</View>;
}
