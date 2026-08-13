import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import type { SupportedCountry } from '../types/config';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { GlassIconButton } from './GlassIconButton';
import { CountryFlag } from './CountryFlag';

// Step title row — 1:1 with the Flutter SDK's StepHeader: optional back button,
// title (heading2) + optional country flag, then an optional description below
// (indented to align under the title when a back button is present).

// Back button width + gap. Kept in step with BACK_SIZE below: it indents the
// description so it starts under the title rather than under the button.
const BACK_SIZE = 40;
const BACK_FOOTPRINT = BACK_SIZE + spacing.sm;

export interface StepHeaderProps {
  title: string;
  description?: string | null;
  onBack?: (() => void) | null;
  country?: SupportedCountry | null;
}

export function StepHeader({ title, description, onBack, country }: StepHeaderProps): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {onBack ? (
          <View style={{ marginRight: spacing.sm }}>
            {/* Same 40pt footprint as the theme/close chrome above it — a
                smaller glass circle here read as a different class of control,
                and 28pt was under the 44pt minimum touch target even with
                hitSlop. */}
            <GlassIconButton
              icon="back"
              onPress={onBack}
              size={BACK_SIZE}
              iconSize={22}
              accessibilityLabel="Back"
            />
          </View>
        ) : null}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <MyazaText variant="heading2" numberOfLines={2} style={{ flexShrink: 1 }}>
            {title}
          </MyazaText>
          {country ? (
            <View style={{ marginLeft: spacing.sm }}>
              <CountryFlag country={country} size={20} />
            </View>
          ) : null}
        </View>
      </View>
      {description ? (
        <MyazaText
          variant="bodyMedium"
          color={colors.textSecondary}
          style={{ marginTop: spacing.xs, marginLeft: onBack ? BACK_FOOTPRINT : 0 }}
        >
          {description}
        </MyazaText>
      ) : null}
    </View>
  );
}
