import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import type { KYCError } from '../types/verification';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MyazaAlert } from '../components/MyazaAlert';
import { Icon } from '../components/Icon';
import { Badge } from './SubmittedBadge';

// The submitted step's error screen (split from SubmittedStep, 200-line
// rule). `onRetry` is null when the failure is not recoverable in-flow (an
// exhausted balance, a refused key); the step decides, this only renders.

const ERROR_TITLES: Record<string, string> = {
  insufficient_credits: 'Credits Exhausted',
  invalid_api_key: 'Authentication Failed',
  feature_disabled: 'Verification Unavailable',
  upload_failed: 'Upload Failed',
  network_error: 'Connection Failed',
};

export function SubmittedError({
  error,
  onRetry,
  onClose,
}: {
  error: KYCError;
  onRetry: (() => void) | null;
  onClose: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const title = ERROR_TITLES[error.code] ?? 'Submission Failed';
  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ height: spacing.xl }} />
        <Badge bg={colors.errorBg} border={`${colors.error}4D`}>
          <Icon name="alert" size={44} color={colors.error} />
        </Badge>
        <View style={{ height: spacing.lg }} />
        <MyazaText variant="heading1" style={{ textAlign: 'center' }}>
          {title}
        </MyazaText>
        <View style={{ height: spacing.md }} />
        <View style={{ width: '100%', paddingHorizontal: spacing.md }}>
          <MyazaAlert variant="error" title="What happened" message={error.message} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {onRetry ? (
          <View style={{ flex: 1 }}>
            <MyazaButton label="Try Again" variant="outline" leadingIcon="refresh" onPress={onRetry} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <MyazaButton label="Close" onPress={onClose} />
        </View>
      </View>
    </View>
  );
}
