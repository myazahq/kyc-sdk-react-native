import React from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { Icon } from '../../components/Icon';
import { MyazaText } from '../../components/Typography';

/**
 * The keep-or-update decision after a pin move.
 *
 * A picked address is never silently replaced by a reverse geocode, and never
 * silently kept against the applicant's wishes either. They choose. Rendered on
 * the pin step only while the question is open (shouldAskLabelDecision).
 */
export function LabelDecisionRow({
  label,
  onKeep,
  onAdopt,
}: {
  /** The picked address line under question. */
  label: string;
  onKeep: () => void;
  onAdopt: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      // Web's `border-primary/25 bg-primary/[0.05]`, as Flutter draws it.
      style={{
        borderWidth: 1,
        borderColor: `${colors.primary}40`,
        borderRadius: radius.md,
        backgroundColor: `${colors.primary}0D`,
        paddingHorizontal: spacing.md - 2,
        paddingVertical: spacing.md - 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${colors.primary}1A`,
          }}
        >
          <Icon name="map-pinned" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <MyazaText variant="bodyMedium" style={{ fontWeight: '600' }}>
            You moved the pin
          </MyazaText>
          <MyazaText variant="bodySmall" color={colors.textSecondary}>
            Keep{' '}
            <MyazaText variant="bodySmall" style={{ fontWeight: '600' }}>
              {label}
            </MyazaText>{' '}
            as your address, or update it to match the new spot?
          </MyazaText>
        </View>
      </View>

      {/* Indented under the text (web pl-11). */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm + 4, paddingLeft: 44 }}>
        <DecisionButton label="Keep this address" primary onPress={onKeep} />
        <DecisionButton label="Use the pin’s address" onPress={onAdopt} />
      </View>
    </View>
  );
}

function DecisionButton({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
        borderRadius: radius.xs,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.primary,
        backgroundColor: primary ? colors.primary : colors.background,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <MyazaText
        variant="bodySmall"
        color={primary ? colors.onPrimary : colors.primary}
        style={{ fontWeight: '500' }}
        numberOfLines={1}
      >
        {label}
      </MyazaText>
    </Pressable>
  );
}
