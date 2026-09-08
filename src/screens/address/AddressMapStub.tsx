import React, { useEffect } from 'react';
import { View } from 'react-native';

import { MyazaText } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { DashedBorder } from '../../components/DashedBorder';
import { useTheme } from '../../components/runtime';
import { spacing } from '../../config/theme';
import type { LatLng } from '../../lib/map-tiles';

// The SANDBOX map stand-in (the web SDK's preview placeholder, for test
// keys): no tiles, no framed page, no vendor loads. The pin lands on the
// default centre once — what the real map's first idle emits — so Continue
// stays reachable and the integrator walks the whole flow.
export function AddressMapStub({
  hasPin,
  onLand,
  defaultCenter,
  height,
}: {
  hasPin: boolean;
  onLand: (pin: LatLng) => void;
  defaultCenter: LatLng;
  height: number;
}) {
  useEffect(() => {
    if (!hasPin) onLand(defaultCenter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPin]);

  const { colors } = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
      }}
    >
      <DashedBorder color={colors.border} radius={12} strokeWidth={1} />
      <Icon name="map-pin-house" size={32} color={colors.textSecondary} />
      <View style={{ height: spacing.sm }} />
      <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ textAlign: 'center' }}>
        Applicants place their pin on a live map here. The map loads only for real users.
      </MyazaText>
    </View>
  );
}
