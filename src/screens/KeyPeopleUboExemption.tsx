import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '../components/Icon';
import { MyazaText } from '../components/Typography';
import { useTheme } from '../components/runtime';
import { spacing } from '../config/theme';

// The FATF fallback, attested: some companies genuinely have no natural
// person who qualifies as a UBO (listed companies, complex trusts, nominee
// arrangements), and without this box the applicant's only moves were to
// stall or to invent one. It is an attestation the org can branch on, never a
// verdict — and it is disabled the moment a UBO is listed, because the two
// claims contradict. Mirrors the web SDK's KeyPeopleUboExemption.

export function KeyPeopleUboExemption({
  checked,
  hasUbos,
  onChange,
}: {
  checked: boolean;
  hasUbos: boolean;
  onChange: (checked: boolean) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.sm + 4 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: hasUbos }}
        disabled={hasUbos}
        onPress={() => onChange(!checked)}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          opacity: hasUbos ? 0.5 : 1,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            marginTop: 1,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: checked ? colors.primary : colors.border,
            backgroundColor: checked ? colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <Icon name="check" size={13} color={colors.onPrimary} /> : null}
        </View>
        <MyazaText variant="bodyMedium" color={colors.textSecondary} style={{ flex: 1 }}>
          UBOs cannot be identified due to public share structures, complex trusts or nominee
          arrangements.
        </MyazaText>
      </Pressable>
      {checked && !hasUbos ? (
        <MyazaText
          variant="bodySmall"
          color={colors.textSecondary}
          style={{ marginTop: 6, paddingLeft: 32 }}
        >
          We will record this with the application; a senior person is still identified through
          the applicant's own verification.
        </MyazaText>
      ) : null}
    </View>
  );
}
