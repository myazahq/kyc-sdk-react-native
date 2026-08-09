import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaInput } from '../components/MyazaInput';
import { PhoneNumberInput } from '../components/PhoneNumberInput';

/**
 * "Where should we send it": an email field, or the dial-code phone input that
 * formats nationally and emits E.164. Mirrors the web SDK's component of the
 * same name and Flutter's ContactDestinationField.
 */
export function ContactDestinationField({
  isEmail,
  email,
  onEmailChange,
  onPhoneChange,
  defaultCountry,
  error,
  disabled,
}: {
  isEmail: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: { e164: string; isValid: boolean }) => void;
  defaultCountry?: string;
  error: string | null;
  disabled?: boolean;
}): React.ReactElement {
  if (isEmail) {
    return (
      <MyazaInput
        label="Email address"
        value={email}
        onChangeText={onEmailChange}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={error}
        editable={!disabled}
        autoFocus
      />
    );
  }

  return (
    <View>
      <MyazaText variant="label" style={{ marginBottom: spacing.xs }}>
        Phone number
      </MyazaText>
      <PhoneNumberInput
        defaultCountry={defaultCountry}
        disabled={disabled}
        onChange={onPhoneChange}
      />
      {error ? <ErrorLine text={error} /> : null}
    </View>
  );
}

function ErrorLine({ text }: { text: string }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.xs }}>
      {text}
    </MyazaText>
  );
}
