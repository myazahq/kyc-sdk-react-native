import React from 'react';
import { Pressable, View } from 'react-native';

import { spacing, radius } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaInput } from '../components/MyazaInput';
import { emptyKeyPersonOwner, type KeyPersonOwnerEntry } from '../config/keyPeople';

const MAX_OWNERS = 10;

// Who owns this company.
//
// A beneficial owner is a natural person, so a corporate shareholder is a
// branch of the ownership chain that stops at a legal entity. Where the company
// is registered somewhere we can look up, the server follows it. Where it is
// not — a foreign parent, an offshore vehicle — this is the only route to the
// people above it, and asking is better than recording nothing.
//
// Deliberately short: a name and a share. Everything else about them is
// unknowable to the person filling in this form, and a longer list is one
// people abandon.

export function KeyPersonOwners({
  owners,
  onChange,
  companyName,
}: {
  owners: KeyPersonOwnerEntry[];
  onChange: (owners: KeyPersonOwnerEntry[]) => void;
  companyName: string;
}): React.ReactElement {
  const { colors } = useTheme();
  const patch = (index: number, next: Partial<KeyPersonOwnerEntry>) =>
    onChange(owners.map((o, i) => (i === index ? { ...o, ...next } : o)));

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        padding: spacing.md,
      }}
    >
      <MyazaText variant="bodySmall" style={{ fontWeight: '600' }}>
        Who owns {companyName.trim() || 'this company'}? (optional)
      </MyazaText>
      <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 2 }}>
        A company cannot verify an identity, so tell us the people behind it if you know them.
      </MyazaText>

      {owners.map((owner, index) => (
        <View key={index} style={{ marginTop: spacing.sm }}>
          <MyazaInput
            label={`Owner ${index + 1}`}
            value={owner.name}
            onChangeText={(name) => patch(index, { name })}
            placeholder="Full name"
            autoCapitalize="words"
          />
          <View style={{ height: spacing.xs }} />
          <MyazaInput
            label="Their share (optional)"
            value={owner.ownershipPct}
            onChangeText={(ownershipPct) => patch(index, { ownershipPct })}
            placeholder="e.g. 75"
            keyboardType="decimal-pad"
            suffix={
              <MyazaText variant="bodySmall" color={colors.textMuted}>
                %
              </MyazaText>
            }
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove owner ${index + 1}`}
            onPress={() => onChange(owners.filter((_, i) => i !== index))}
            style={{ paddingVertical: spacing.xs, alignSelf: 'flex-start' }}
          >
            <MyazaText variant="bodySmall" color={colors.error}>
              Remove
            </MyazaText>
          </Pressable>
        </View>
      ))}

      {owners.length < MAX_OWNERS ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange([...owners, emptyKeyPersonOwner()])}
          style={{
            marginTop: spacing.sm,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <MyazaText variant="bodySmall" style={{ fontWeight: '600' }} color={colors.primary}>
            {owners.length === 0 ? 'Add an owner' : 'Add another'}
          </MyazaText>
        </Pressable>
      ) : null}
    </View>
  );
}
