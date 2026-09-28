import React from 'react';
import { Image, View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { MyazaPulseLoader } from '../../components/MyazaPulseLoader';

/** One captured side as a card-shaped photo, e.g. the two-sided front preview. */
export function DocImage({ uri, label, uploading }: { uri: string; label?: string; uploading?: boolean }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View>
      {label ? (
        <MyazaText variant="bodySmall" color={colors.textMuted} style={{ textAlign: 'center', marginBottom: spacing.xs }}>
          {label}
        </MyazaText>
      ) : null}
      <View style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <Image source={{ uri }} style={{ width: '100%', aspectRatio: 1.586 }} resizeMode="cover" />
        {/* Standard upload loader — a dark scrim + the pulse-ring/spinner loader
            rendered INSIDE the preview frame, mirroring the web/Flutter SDKs (and
            the liveness selfie review). */}
        {uploading ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}
          >
            <MyazaPulseLoader size={64} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
