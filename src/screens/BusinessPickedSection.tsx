import React from 'react';
import { View } from 'react-native';

import { MyazaText } from '../components/Typography';
import { useTheme } from '../components/runtime';
import { spacing } from '../config/theme';
import { BusinessPickedCard } from './BusinessPickedCard';
import { BusinessSandboxToggle } from './BusinessSandboxToggle';

// The picked-company section: the card, what Continue is about to do, and the
// dev-only test-result pin. Split from BusinessDetailsStep (200-line rule).

export function BusinessPickedSection({
  country,
  name,
  registrationNumber,
  isSandbox,
  onChange,
}: {
  country: string;
  name: string;
  registrationNumber: string;
  isSandbox: boolean;
  onChange: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <>
      <BusinessPickedCard
        country={country}
        name={name}
        registrationNumber={registrationNumber}
        onChange={onChange}
      />
      <View style={{ height: spacing.lg }} />
      {/* Says what the button is about to do: Continue runs a real lookup
          against the register, which takes a moment and is charged to the
          organisation. "Continue" alone made a paid outbound call look like
          moving to the next page. */}
      <MyazaText variant="bodySmall" color={colors.textSecondary}>
        Continue checks this business against the official register and brings back its details.
      </MyazaText>
      {isSandbox ? (
        <>
          <View style={{ height: spacing.lg }} />
          <BusinessSandboxToggle />
        </>
      ) : null}
    </>
  );
}
