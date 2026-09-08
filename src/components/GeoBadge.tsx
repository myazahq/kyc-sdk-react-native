import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';

/**
 * The "Your location" pill beside a pinned geo row: primary tint, primary
 * text. It marks a GUESS made on the visitor's behalf, never a verdict, and
 * the row it sits on is one tap away rather than buried in the alphabet.
 * Shared by the country-select picker and the dial-code sheet so the tag
 * reads identically wherever the guess is offered.
 */
export function GeoBadge({ label }: { label: string }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        marginRight: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.primary,
        backgroundColor: colors.primary50,
      }}
    >
      <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '500' }}>
        {label}
      </MyazaText>
    </View>
  );
}
