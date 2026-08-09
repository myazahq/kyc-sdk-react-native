import React from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { Icon } from './Icon';

// ---------------------------------------------------------------------------
// The tappable choice card.
//
// Every step that offers a set of options renders one of these: questionnaire
// selects, the proof-of-address document kind, the KYB registry country and
// product, the applicant's role. They were four near-identical copies before
// this, which is four places for the selected state to drift apart.
//
// A card rather than a picker wheel because the options are the information —
// hiding them behind a tap makes the user open it to find out what is on offer.
// ---------------------------------------------------------------------------

export function OptionRow({
  label,
  selected,
  multi,
  leading,
  trailing,
  onPress,
}: {
  label: string;
  selected: boolean;
  /** Renders a square check instead of a radio dot. */
  multi?: boolean;
  /** Something before the label — a flag, an icon. Replaces the radio mark. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        // The checkbox variant matches the web SDK's multi-select card exactly
        // (`rounded-xl border p-3`), since the same questionnaire renders on
        // both and a differently-proportioned card reads as a different control.
        paddingHorizontal: spacing.sm + 4,
        paddingVertical: multi ? spacing.sm + 4 : spacing.sm + 2,
        borderRadius: multi ? radius.sm : radius.md,
        borderWidth: multi ? 1 : 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? `${colors.primary}0D` : 'transparent',
        marginBottom: spacing.sm,
      }}
    >
      {leading ?? <SelectionMark selected={selected} multi={multi} />}
      <View style={{ width: multi ? 10 : spacing.sm }} />
      <MyazaText variant="body" style={{ flex: 1 }}>
        {label}
      </MyazaText>
      {trailing}
    </Pressable>
  );
}

function SelectionMark({
  selected,
  multi,
}: {
  selected: boolean;
  multi?: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 20,
        height: 20,
        // A checkbox is a rounded SQUARE (web's `rounded-md`), not a rounded
        // rectangle — radius.sm (12) on a 20px box reads almost circular.
        borderRadius: multi ? 6 : radius.full,
        borderWidth: multi ? 1 : 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? <Icon name="check" size={multi ? 14 : 13} color={colors.onPrimary} /> : null}
    </View>
  );
}

/** A compact pill for choices that read better inline (currencies, roles). */
export function OptionPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={{
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 8,
        borderRadius: radius.full,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? `${colors.primary}14` : 'transparent',
      }}
    >
      <MyazaText
        variant="bodySmall"
        color={selected ? colors.primary : colors.textMuted}
        style={{ fontWeight: '600' }}
      >
        {label}
      </MyazaText>
    </Pressable>
  );
}
