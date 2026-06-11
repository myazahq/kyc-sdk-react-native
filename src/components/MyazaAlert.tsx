import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';

// Info / success / warning / error banner. Mirrors the Flutter SDK's MyazaAlert.

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface MyazaAlertProps {
  variant: AlertVariant;
  title?: string;
  message: string;
}

export function MyazaAlert({ variant, title, message }: MyazaAlertProps): React.ReactElement {
  const { colors } = useTheme();
  const bg =
    variant === 'success'
      ? colors.successBg
      : variant === 'warning'
        ? colors.warningBg
        : variant === 'error'
          ? colors.errorBg
          : colors.infoBg;
  const accent =
    variant === 'success'
      ? colors.success
      : variant === 'warning'
        ? colors.warning
        : variant === 'error'
          ? colors.error
          : colors.info;

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: radius.sm,
        padding: spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: accent,
      }}
    >
      {title ? (
        <MyazaText variant="label" color={accent} style={{ marginBottom: 2 }}>
          {title}
        </MyazaText>
      ) : null}
      <MyazaText variant="bodyMedium" color={colors.textDark}>
        {message}
      </MyazaText>
    </View>
  );
}
