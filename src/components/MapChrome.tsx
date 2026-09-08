import React from 'react';
import { Pressable, View } from 'react-native';

import { radius } from '../config/theme';
import { useTheme } from './runtime';
import { Icon } from './Icon';
import { MyazaText } from './Typography';

// The map's furniture, split from MapPinPicker per the 200-line rule.

/** Zoom controls, top-right. Absent on a read-only summary map. */
export function MapZoomControls({ onZoom }: { onZoom: (delta: number) => void }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        right: 8,
        top: 8,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zoom in"
        onPress={() => onZoom(1)}
        style={{ padding: 8 }}
      >
        <Icon name="plus" size={16} color={colors.textDark} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zoom out"
        onPress={() => onZoom(-1)}
        style={{ padding: 8, borderTopWidth: 1, borderTopColor: colors.border }}
      >
        <Icon name="minus" size={16} color={colors.textDark} />
      </Pressable>
    </View>
  );
}

/** OSM tile-usage terms require this to be visible wherever the tiles are. */
export function MapAttribution(): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        right: 6,
        bottom: 4,
        paddingHorizontal: 4,
        borderRadius: 3,
        backgroundColor: colors.background + 'B3',
      }}
    >
      <MyazaText variant="bodySmall" style={{ fontSize: 10 }} color={colors.textSecondary}>
        © OpenStreetMap contributors
      </MyazaText>
    </View>
  );
}
