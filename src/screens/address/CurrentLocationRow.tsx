import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { Icon } from '../../components/Icon';
import { MyazaText } from '../../components/Typography';

/**
 * "Use my current location" as a proper row, not a button pretending to be two:
 * a medallion showing the fix's state, the RESOLVED ADDRESS underneath the
 * title — so the person can see where it will take them before tapping — and a
 * chevron that says this goes somewhere.
 *
 * Shared by the search step and by the pin step while no pin exists.
 */
export function CurrentLocationRow({
  hint,
  locating,
  onPress,
}: {
  /** The device's resolved current address, when known. */
  hint: string | null;
  locating: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Use my current location"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md - 2,
        paddingVertical: spacing.md - 4,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: pressed ? colors.primary : colors.border,
        backgroundColor: pressed ? colors.primary50 : colors.backgroundSecondary,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hint ? colors.primary : colors.primary100,
        }}
      >
        {locating && !hint ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Icon
            name={hint ? 'map-pin' : 'locate'}
            size={18}
            color={hint ? colors.onPrimary : colors.primary}
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <MyazaText variant="bodyMedium" style={{ fontWeight: '600' }}>
          Use my current location
        </MyazaText>
        <MyazaText variant="bodySmall" color={colors.textSecondary} numberOfLines={1}>
          {hint ?? (locating ? 'Finding your location…' : 'Lands the pin right where you are')}
        </MyazaText>
      </View>
      <Icon name="chevron-right" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

/**
 * The DEMOTED form of the row above, for once a pin exists. Locating again is
 * then a rare corrective action, so it becomes a labelled chip ON the map,
 * bottom centre — where the eye and thumb already are, and clear of the corners
 * that belong to attribution and the zoom controls.
 *
 * Off the Continue path and deliberate to hit, where the full-width row invited
 * a mistaken tap that yanked a confirmed address to wherever the phone was.
 */
export function LocateChip({
  locating,
  onPress,
}: {
  locating: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: spacing.md, alignItems: 'center' }}
    >
      <Pressable
        onPress={locating ? undefined : onPress}
        disabled={locating}
        accessibilityRole="button"
        accessibilityLabel="Move the pin to my current location"
        // Web's `h-10 pl-3 pr-3.5 gap-2 shadow-md`, as Flutter draws it.
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          height: 40,
          paddingLeft: spacing.sm + 4,
          paddingRight: spacing.md - 2,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
          shadowColor: colors.textDark,
          shadowOpacity: 0.12,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        })}
      >
        {locating ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Icon name="locate" size={16} color={colors.primary} />
        )}
        <MyazaText variant="bodySmall" style={{ fontWeight: '600' }}>
          {locating ? 'Finding you…' : 'Use my location'}
        </MyazaText>
      </Pressable>
    </View>
  );
}
