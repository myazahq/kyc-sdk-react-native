import React from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { MyazaPulseLoader } from '../../components/MyazaPulseLoader';
import { StyleAbsFill } from './constants';

// ---------------------------------------------------------------------------
// The captured selfie, shown back while it uploads.
// ---------------------------------------------------------------------------

export function SelfiePreview({ uri, uploading }: { uri: string | null; uploading?: boolean }): React.ReactElement {
  const { colors } = useTheme();
  const S = 200;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }}>
      <View style={{ width: S, height: S, borderRadius: S / 2, borderWidth: 4, backgroundColor: uri ? '#111111' : `${colors.primary}14`, borderColor: `${colors.primary}33`, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {/* borderRadius repeated on the Image — iOS doesn't reliably clip an Image
            child to a rounded parent (same fix as the header brand bar). A null
            uri is a restored session whose local file is gone: the uploaded
            selfie is the durable record, so show a completed state rather than
            a broken image. */}
        {uri ? (
          <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: S / 2 }} resizeMode="cover" />
        ) : (
          <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ textAlign: 'center', paddingHorizontal: spacing.lg }}>
            Selfie already captured
          </MyazaText>
        )}
        {/* Standard upload loader inside the preview circle (mirrors web/Flutter). */}
        {uploading ? (
          <View style={[StyleAbsFill, { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }]}>
            <MyazaPulseLoader size={64} />
          </View>
        ) : null}
      </View>
      <View style={{ height: spacing.md }} />
      <MyazaText variant="heading3" style={{ textAlign: 'center' }}>
        Looking good!
      </MyazaText>
      <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ textAlign: 'center' }}>
        Tap Continue to submit, or Retake to try again.
      </MyazaText>
    </View>
  );
}
