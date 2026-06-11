import React, { useState } from 'react';
import {
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

type FocusHandler = NonNullable<TextInputProps['onFocus']>;
type BlurHandler = NonNullable<TextInputProps['onBlur']>;

import { radius, sizing, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';

// Branded text input with label, helper, and error states. Mirrors the Flutter
// SDK's MyazaInput.

export interface MyazaInputProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
  error?: string | null;
  helper?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'characters';
  maxLength?: number;
  editable?: boolean;
  /** Focus the field on mount (matches the Flutter SDK's id-input autofocus). */
  autoFocus?: boolean;
  onFocus?: FocusHandler;
  onBlur?: BlurHandler;
}

export function MyazaInput({
  value,
  onChangeText,
  label,
  placeholder,
  error,
  helper,
  keyboardType = 'default',
  autoCapitalize = 'none',
  maxLength,
  editable = true,
  autoFocus = false,
  onFocus,
  onBlur,
}: MyazaInputProps): React.ReactElement {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  // Mirror the Flutter SDK's MyazaInput border states:
  //   focused + error → error / 2px   ·   focused → primary / 2px
  //   error           → error / 1.5px ·   default → border / 1px
  const borderColor = error ? colors.error : focused ? colors.primary : colors.border;
  const borderWidth = focused ? 2 : error ? 1.5 : 1;

  const handleFocus: FocusHandler = (e) => {
    setFocused(true);
    onFocus?.(e);
  };
  const handleBlur: BlurHandler = (e) => {
    setFocused(false);
    onBlur?.(e);
  };

  return (
    <View>
      {label ? (
        <MyazaText variant="label" style={{ marginBottom: spacing.sm }}>
          {label}
        </MyazaText>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        editable={editable}
        autoFocus={autoFocus}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{
          height: sizing.inputHeight,
          borderWidth,
          borderColor,
          borderRadius: radius.sm,
          // Keep text from shifting when the border thickens on focus: pad so
          // (border + padding) stays constant across states (max border = 2).
          paddingHorizontal: spacing.md + (2 - borderWidth),
          color: colors.textDark,
          backgroundColor: colors.background,
          fontSize: 16,
        }}
      />
      {error ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.xs }}>
          {error}
        </MyazaText>
      ) : helper ? (
        <MyazaText variant="bodySmall" style={{ marginTop: spacing.xs }}>
          {helper}
        </MyazaText>
      ) : null}
    </View>
  );
}
