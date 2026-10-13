import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../runtime';
import { UiText } from '../Typography';
import { UiButton } from '../UiButton';
import { Icon } from '../Icon';
import { VerificationSheet } from '../VerificationSheet';

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
    <VerificationSheet title="" onClose={onClose} hideBrand>
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
        <UiText variant="heading2" style={{ textAlign: 'center' }}>
          Unable to start verification
        </UiText>
        <View style={{ height: spacing.xs }} />
        <UiText variant="bodyMedium" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          {message ?? 'Please check your API key and try again.'}
        </UiText>
        <View style={{ height: spacing.lg }} />
        <View style={{ width: '100%' }}>
          <UiButton label="Close" onPress={onClose} />
        </View>
      </View>
    </VerificationSheet>
  );
}
