import React from 'react';
import { useWindowDimensions, View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { Icon } from '../../components/Icon';
import { MyazaText } from '../../components/Typography';
import { MyazaButton } from '../../components/MyazaButton';
import { StickyActions } from '../../components/StickyActions';
import { mapSurfaceHeight } from '../../lib/map-tiles';

// The entrance step's SANDBOX stand-in. A SANDBOX mount keeps the step real
// users get, on a static placeholder (the camera steps' rule): no Google
// loads from a test key, the server cans the verdict regardless, and "Use
// this view" simply advances. Mirrors the web SDK's preview branch; the
// Flutter twin is address_entrance_framing.dart.

export function EntrancePlaceholder({
  hideSkip,
  onSkip,
  onUse,
}: {
  hideSkip: boolean;
  onSkip: () => void;
  onUse: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const height = mapSurfaceHeight(useWindowDimensions());
  return (
    <StickyActions
      actions={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {!hideSkip ? (
            <View style={{ flex: 1 }}>
              <MyazaButton label="Skip" variant="outline" onPress={onSkip} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <MyazaButton label="Use this view" onPress={onUse} />
          </View>
        </View>
      }
    >
      <View
        style={{
          height,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          // Web's `rounded-xl border-2 border-dashed bg-muted/40`.
          borderRadius: radius.sm,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.border,
          backgroundColor: `${colors.backgroundSecondary}66`,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Icon name="landmark" size={32} color={`${colors.textSecondary}99`} />
        <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 288 }}>
          Applicants pan real street imagery to frame their entrance here. It loads only for real users.
        </MyazaText>
      </View>
    </StickyActions>
  );
}
