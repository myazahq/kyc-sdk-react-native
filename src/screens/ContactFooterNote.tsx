import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { Icon } from '../components/Icon';

/**
 * The reassurance line under the contact step's actions, matching the web SDK.
 *
 * Small, but it answers the question the step provokes: an email step is asked
 * "what will you do with my address", a phone step "will this cost me money".
 */
export function ContactFooterNote({ isEmail }: { isEmail: boolean }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
      }}
    >
      <Icon name={isEmail ? 'mail' : 'smartphone'} size={12} color={colors.textMuted} />
      <MyazaText variant="bodySmall" color={colors.textMuted}>
        {isEmail
          ? 'We only use this to verify your identity.'
          : 'Standard message rates may apply.'}
      </MyazaText>
    </View>
  );
}
