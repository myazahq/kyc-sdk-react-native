import React from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { Icon } from '../../components/Icon';
import { MyazaText } from '../../components/Typography';
import { LineReveal, LineSkeleton } from '../../components/LineSkeleton';
import { ADDRESS_LINE_PENDING, ADDRESS_LINE_UNAVAILABLE } from '../../lib/address-line';
import { detailCount } from './DetailsSheet';

/**
 * What the pin currently says, and the way into the details sheet.
 *
 * The line is the composed one (displayAddressLine), the same string the review
 * step heads its card with, so the applicant confirms exactly what they were
 * shown here.
 */
export function PinSummaryRow({
  line,
  labelling,
  values,
  disabled,
  onPress,
}: {
  /** The composed line; '' while the pin has no readable address yet, and
   *  null when no pin has been placed at all. */
  line: string | null;
  /** A reverse geocode is out, so '' means "coming" rather than "none". */
  labelling: boolean;
  values: Parameters<typeof detailCount>[0];
  disabled: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const count = detailCount(values);
  // Three states, and none of them is a coordinate pair: no pin at all, a pin
  // whose address is still being read (a skeleton line at the text's own
  // height, so nothing moves when the words land), and a pin the geocoder had
  // no address for.
  const pending = line === '' && labelling;
  const title = line === null ? 'No pin placed yet' : line || ADDRESS_LINE_UNAVAILABLE;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md - 2,
        paddingVertical: spacing.sm + 4,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        backgroundColor: colors.backgroundSecondary,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {pending ? (
          <LineSkeleton label={ADDRESS_LINE_PENDING} variant="bodyMedium" textStyle={{ fontWeight: '600' }} />
        ) : (
          <LineReveal key={title}>
            <MyazaText
              variant="bodyMedium"
              style={{ fontWeight: '600' }}
              color={line ? undefined : colors.textSecondary}
              numberOfLines={1}
            >
              {title}
            </MyazaText>
          </LineReveal>
        )}
        <MyazaText variant="bodySmall" color={colors.textSecondary} numberOfLines={1}>
          {count > 0
            ? `${count} detail${count === 1 ? '' : 's'} added`
            : 'A house number and directions help someone find it'}
        </MyazaText>
      </View>

      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Edit details"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs + 2,
          height: 36,
          paddingHorizontal: spacing.sm + 4,
          borderRadius: radius.xs,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.primary50 : colors.background,
          opacity: disabled ? 0.5 : 1,
        })}
      >
        <Icon name="pencil-line" size={14} color={colors.primary} />
        <MyazaText variant="bodyMedium" color={colors.primary} style={{ fontWeight: '600' }}>
          Edit details
        </MyazaText>
      </Pressable>
    </View>
  );
}
