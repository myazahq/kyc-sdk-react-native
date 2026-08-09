import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { Icon } from './Icon';

/**
 * "This is already verified" confirmation, shown when a user returns to a
 * contact step they have already passed.
 *
 * A primary-tinted card rather than a bare row, matching the web and Flutter
 * SDKs: it is the one moment in the step that reports success, and it should
 * read as a result rather than as another line of copy.
 */
export function VerifiedNotice({ label }: { label: string }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 4,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: `${colors.primary}0D`,
        borderWidth: 1,
        borderColor: `${colors.primary}4D`,
      }}
    >
      <Icon name="badge-check" size={20} color={colors.primary} />
      <MyazaText variant="body" style={{ flex: 1, fontWeight: '600' }}>
        {label}
      </MyazaText>
    </View>
  );
}
