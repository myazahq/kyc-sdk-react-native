import React from 'react';
import { Pressable } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';

/**
 * The address flow's escape, on the search / pin / review steps.
 *
 * It leaves the WHOLE flow, not just the step: a person who does not want to
 * give an address should not be walked through the remaining three screens to
 * decline three more times. The entrance step has no skip link of its own — it
 * carries its own escapes instead.
 *
 * Hidden entirely when the workflow requires a pin.
 */
export function SkipForNow({
  requirePin,
  onPress,
}: {
  requirePin: boolean | undefined;
  onPress: () => void;
}): React.ReactElement | null {
  const { colors } = useTheme();
  if (requirePin === true) return null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Skip for now"
      style={{ alignItems: 'center', marginTop: spacing.md, paddingVertical: spacing.sm }}
    >
      <MyazaText
        variant="bodyMedium"
        color={colors.textSecondary}
        style={{ textDecorationLine: 'underline' }}
      >
        Skip for now
      </MyazaText>
    </Pressable>
  );
}
