import React from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';

// Person or company.
//
// The first question on the form, because it changes what the rest of it asks:
// a company has a registration number rather than an ID country, and no
// identity of its own to verify. Left unasked, a limited company was collected
// as a person, escalated to beneficial owner (which by definition means a
// natural person), and sent a link to take a selfie.

export function KeyPersonKindToggle({
  isCorporate,
  onChange,
}: {
  isCorporate: boolean;
  onChange: (isCorporate: boolean) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const options: Array<{ value: boolean; label: string }> = [
    { value: false, label: 'A person' },
    { value: true, label: 'A company' },
  ];

  return (
    <View>
      <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        Who is this?
      </MyazaText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {options.map(({ value, label }) => {
          const selected = isCorporate === value;
          return (
            <Pressable
              key={label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
              onPress={() => onChange(value)}
              style={{
                flex: 1,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? `${colors.primary}1A` : 'transparent',
              }}
            >
              <MyazaText
                variant="bodySmall"
                style={{ fontWeight: '600' }}
                color={selected ? colors.primary : colors.textSecondary}
              >
                {label}
              </MyazaText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
