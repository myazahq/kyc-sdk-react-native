import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { CountryFlag } from './CountryFlag';
import { GeoBadge } from './GeoBadge';
import type { DialCodeOption } from './DialCodePicker';

// ---------------------------------------------------------------------------
// One country in the dial-code sheet. Extracted from DialCodePicker (200-line
// rule) and shared by the pinned geo row and the alphabetical ones, so the two
// cannot drift apart: they are the same control in two positions, and the
// pinned one only differs by carrying a tag and a hairline beneath it.
// ---------------------------------------------------------------------------

export function DialCodeRow({
  option,
  isSelected,
  badge,
  onPress,
}: {
  option: DialCodeOption;
  isSelected: boolean;
  /** Tags the pinned geo row ("Your location"). */
  badge?: string;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={badge ? `${option.name}, ${badge.toLowerCase()}` : option.name}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        // Roomier rows: a country list is a long scan, and cramped rows make
        // every tap a precision job. Matches the web dropdown's row height.
        paddingVertical: 12,
        backgroundColor: isSelected ? colors.primary50 : 'transparent',
      }}
    >
      <CountryFlag country={option.code} size={28} />
      <View style={{ width: spacing.md }} />
      {/* No line clamp: "Bosnia & Herzegovina" and the like must read in full,
          which is what Flutter's Expanded(Text) gives. Full body size (16),
          the web dropdown's reading size — 14 read small against the flags. */}
      <MyazaText variant="body" style={{ flex: 1 }}>
        {option.name}
      </MyazaText>
      {badge ? <GeoBadge label={badge} /> : null}
      {option.dialCode != null ? (
        <MyazaText variant="bodyMedium" color={colors.textSecondary}>
          {option.dialCode}
        </MyazaText>
      ) : null}
    </Pressable>
  );
}

/**
 * A region label between grouped rows — the country-select step's header
 * (uppercase, tracked out), so the two pickers read as one control.
 */
export function DialCodeRegionHeader({ region }: { region: string }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <MyazaText
      variant="bodySmall"
      color={colors.textSecondary}
      accessibilityRole="header"
      style={{
        fontWeight: '700',
        letterSpacing: 0.6,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.xs,
      }}
    >
      {region.toUpperCase()}
    </MyazaText>
  );
}

/** The hairline under the pinned row, separating it from the alphabet. */
export function DialCodeDivider(): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        marginHorizontal: spacing.md,
        marginVertical: spacing.xs,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}
    />
  );
}
