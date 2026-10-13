import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { UiText } from '../../components/Typography';
import { Icon } from '../../components/Icon';

// "Required: {label}" pill with optional side badge + step label — mirrors the
// Flutter SDK's _RequiredPill on the capture screen.
export function RequiredPill({
  documentLabel,
  sideBadge,
  stepLabel,
}: {
  documentLabel: string;
  sideBadge?: string;
  stepLabel?: string;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          borderWidth: 1,
          borderColor: `${colors.primary}33`,
          backgroundColor: `${colors.primary}0D`,
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm + 4,
          paddingVertical: spacing.sm,
        }}
      >
        <Icon name="credit-card" size={16} color={colors.primary} />
        <View style={{ width: 8 }} />
        <UiText variant="bodySmall" color={colors.primary} style={{ fontWeight: '600' }}>
          Required:{' '}
        </UiText>
        <UiText variant="bodySmall" color={colors.primary} style={{ flexShrink: 1 }}>
          {documentLabel}
        </UiText>
        {sideBadge ? (
          <View style={{ backgroundColor: `${colors.primary}26`, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 }}>
            <UiText variant="bodySmall" color={colors.primary} style={{ fontWeight: '600', fontSize: 11 }}>
              {sideBadge}
            </UiText>
          </View>
        ) : null}
      </View>
      {stepLabel ? (
        <UiText variant="bodySmall" color={colors.textMuted} style={{ marginLeft: spacing.sm }}>
          {stepLabel}
        </UiText>
      ) : null}
    </View>
  );
}
