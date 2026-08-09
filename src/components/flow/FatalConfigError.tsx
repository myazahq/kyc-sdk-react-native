import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../runtime';
import { MyazaText } from '../Typography';
import { MyazaButton } from '../MyazaButton';
import { Icon } from '../Icon';
import { KycSheet } from '../KycSheet';

/**
 * The flow cannot start — a bad API key, or a feature the org cannot use.
 *
 * Terminal by design: there is nothing the user can do about it and no step to
 * fall back to, so the only action offered is Close. The consumer has already
 * been told through `onError`; this is what the person holding the phone sees.
 */
export function FatalConfigError({
  message,
  onClose,
}: {
  message?: string | null;
  onClose: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <KycSheet title="" onClose={onClose} hideBrand>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: radius.full,
            backgroundColor: `${colors.error}1A`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="alert" size={40} color={colors.error} />
        </View>
        <View style={{ height: spacing.lg }} />
        <MyazaText variant="heading2" style={{ textAlign: 'center' }}>
          Unable to start verification
        </MyazaText>
        <View style={{ height: spacing.xs }} />
        <MyazaText variant="bodyMedium" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          {message ?? 'Please check your API key and try again.'}
        </MyazaText>
        <View style={{ height: spacing.lg }} />
        <View style={{ width: '100%' }}>
          <MyazaButton label="Close" onPress={onClose} />
        </View>
      </View>
    </KycSheet>
  );
}
