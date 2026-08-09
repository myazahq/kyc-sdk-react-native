import React, { useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { MyazaInput } from './MyazaInput';
import type { OtpInputStyle } from '../types/workflow';

// ---------------------------------------------------------------------------
// The OTP code field.
//
// Which one renders — segmented boxes or a plain field — is the ORG's choice in
// the workflow builder (`inputStyle`), not the end user's.
//
// The segmented version is ONE hidden TextInput with boxes drawn over it, not
// N inputs with focus-juggling between them. That is what makes SMS autofill
// work (the platform fills a single field), makes paste work, and makes
// backspace behave — a per-box implementation breaks all three, and they are
// the three things people actually do with a code.
// ---------------------------------------------------------------------------

export function ContactCodeEntry({
  code,
  onChange,
  codeLength,
  style,
  disabled,
  onComplete,
}: {
  code: string;
  onChange: (code: string) => void;
  codeLength: number;
  /** Config-driven field style ('segmented' default). */
  style: OtpInputStyle;
  disabled?: boolean;
  /** Fires with the full code once the last slot fills (auto-submit). */
  onComplete?: (code: string) => void;
}): React.ReactElement {
  const handle = (raw: string): void => {
    const next = raw.replace(/\D/g, '').slice(0, codeLength);
    onChange(next);
    if (next.length === codeLength) onComplete?.(next);
  };

  if (style === 'text') {
    return (
      <MyazaInput
        label="Verification code"
        value={code}
        onChangeText={handle}
        placeholder={'0'.repeat(codeLength)}
        keyboardType="number-pad"
        maxLength={codeLength}
        editable={!disabled}
        autoFocus
      />
    );
  }

  return <SegmentedCode code={code} onChangeText={handle} codeLength={codeLength} disabled={disabled} />;
}

function SegmentedCode({
  code,
  onChangeText,
  codeLength,
  disabled,
}: {
  code: string;
  onChangeText: (raw: string) => void;
  codeLength: number;
  disabled?: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  return (
    <View>
      {/* Boxes flex to fill the width at a fixed aspect ratio, and the FILLED
          ones carry the primary border — same geometry and same signal as the
          Flutter SDK's OtpInput, so the step reads identically on both. */}
      <Pressable
        onPress={() => inputRef.current?.focus()}
        accessibilityRole="none"
        style={{ flexDirection: 'row', gap: spacing.xs }}
      >
        {Array.from({ length: codeLength }, (_, i) => {
          const filled = i < code.length;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                aspectRatio: 0.82,
                borderRadius: radius.md,
                borderWidth: filled ? 1.5 : 1,
                borderColor: filled ? colors.primary : colors.border,
                backgroundColor: colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MyazaText variant="heading2">{code[i] ?? ''}</MyazaText>
            </View>
          );
        })}
      </Pressable>

      {/* One real input behind the boxes: the platform's SMS autofill targets a
          single field, and paste/backspace only behave against one value. It is
          positioned over the boxes (not display:none) because a zero-size or
          hidden input is skipped by autofill on both platforms. */}
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={codeLength}
        editable={!disabled}
        autoFocus
        caretHidden
        accessibilityLabel="Verification code"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.01,
          color: 'transparent',
          textAlign: 'center',
        }}
      />
    </View>
  );
}
