import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from './runtime';

/**
 * A step's primary actions, held at the bottom edge of a viewport-filling
 * body. Mirrors the web SDK's StickyActions.
 *
 * A step that carries a map or a street panorama fills a phone with a surface
 * that OWNS every touch: dragging it moves the map, never the page, so on a
 * small screen the Continue button beneath it could only be reached by finding
 * a strip of margin to scroll on. Holding the actions under a bounded scroll
 * view means the applicant never has to get past the map to move on, and
 * everything else still scrolls under them.
 *
 * Needs a BOUNDED parent: the step must be listed in KycFlow's fillsViewport
 * set, where the sheet hands it a flex:1 box padded `spacing.md`. The footer's
 * negative margins cancel that padding so the bar meets the sheet's edge, and
 * the same padding is restored inside so the buttons keep their gutter.
 */
export function StickyActions({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions: React.ReactNode;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.sm }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      <View
        style={{
          marginHorizontal: -spacing.md,
          marginBottom: -spacing.md,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
          backgroundColor: colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        }}
      >
        {actions}
      </View>
    </View>
  );
}
