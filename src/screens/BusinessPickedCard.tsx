import React from 'react';
import { Pressable, View } from 'react-native';

import { CountryFlag } from '../components/CountryFlag';
import { Icon } from '../components/Icon';
import { MyazaText } from '../components/Typography';
import { useTheme } from '../components/runtime';
import { radius, spacing } from '../config/theme';

// The company the applicant picked, standing where the search box was.
//
// Choosing a row IS the choice: the card replaces the list, and Change swaps
// back. A separate confirm button meant two primary buttons on screen at once,
// and the card already shows what was picked — the confirmation is the screen
// after, not a button before it. Dimensions mirror the web SDK's picked card
// (40px badge, 12px padding and gaps).

export function BusinessPickedCard({
  country,
  name,
  registrationNumber,
  onChange,
}: {
  country: string;
  name: string;
  registrationNumber: string;
  onChange: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View>
      <MyazaText variant="label" style={{ marginBottom: spacing.sm }}>
        Business
      </MyazaText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderWidth: 1,
          borderColor: colors.primary,
          backgroundColor: colors.primary50,
          borderRadius: radius.sm,
          padding: 12,
        }}
      >
        {/* The badge: the company as a thing that has been chosen, in the same
            filled-circle language the picked rows of every other list use. */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
          }}
        >
          <Icon name="building-2" size={20} color={colors.onPrimary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <MyazaText variant="label" color={colors.textDark} numberOfLines={1}>
            {name.trim() || 'We will confirm the name with the register'}
          </MyazaText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <CountryFlag country={country} size={14} />
            <MyazaText variant="bodySmall" color={colors.textSecondary}>
              {registrationNumber}
            </MyazaText>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onChange}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}
        >
          <Icon name="pencil" size={14} color={colors.textDark} />
          <MyazaText variant="bodyMedium" style={{ fontWeight: '500' }} color={colors.textDark}>
            Change
          </MyazaText>
        </Pressable>
      </View>
    </View>
  );
}
