import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { CountryFlag } from './CountryFlag';
import { DialCodePicker, type DialCodeOption } from './DialCodePicker';
import { Icon } from './Icon';

// ---------------------------------------------------------------------------
// A country select field: a MyazaSelect-styled collapsed trigger (flag + name
// + chevron) that opens THE country sheet — the phone field's dial-code picker
// minus the dial codes (keyboard-aware, autofocused search, results pinned
// above the keys). Used wherever a country is picked from a flat list (the
// key-person "where their ID was issued", the KYB "Country of registration"),
// so every country picker in the flow feels identical.
// ---------------------------------------------------------------------------

export function CountryField({
  value,
  options,
  onChange,
  placeholder = 'Select a country',
  searchPlaceholder = 'Search country',
}: {
  /** ISO-2 of the current pick; empty/null shows the placeholder. */
  value: string | null;
  /** The pickable countries — all ISO, or a workflow's registry subset. */
  options: DialCodeOption[];
  onChange: (code: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}): React.ReactElement {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const name = value ? (options.find((o) => o.code === value)?.name ?? value) : null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={name ?? placeholder}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        {value ? (
          <>
            <CountryFlag country={value} size={20} />
            <View style={{ width: spacing.sm }} />
          </>
        ) : null}
        <MyazaText
          variant="body"
          color={name ? undefined : colors.textMuted}
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {name ?? placeholder}
        </MyazaText>
        <View style={{ width: spacing.sm }} />
        <Icon name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>

      <DialCodePicker
        visible={open}
        options={options}
        selected={value ?? ''}
        searchPlaceholder={searchPlaceholder}
        onPick={(code) => {
          setOpen(false);
          onChange(code);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
