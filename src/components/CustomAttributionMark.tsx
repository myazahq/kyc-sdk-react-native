import React, { useState } from 'react';
import { Image, View } from 'react-native';

import { CUSTOM_LOGO_HEIGHT, CUSTOM_LOGO_MAX_WIDTH, customLogoLabel, customLogoWidth } from '../lib/trust-attribution';
import { MyazaText } from './Typography';

// The org's own logo in place of the Myaza Trust lockup (custom attribution).
// Mirrors the web SDK's TrustAttributionMark custom branch: sized like the
// Myaza wordmark (24 tall, width from the image's own ratio, at most 144
// wide, contained), sitting on the surface as uploaded with no plate or
// filter, and NO Myaza mark or link. A logo that fails to load falls back to
// the organisation's name, never to Myaza.

export function CustomAttributionMark({
  logo,
  companyName,
  markColor,
}: {
  logo?: string;
  companyName?: string;
  markColor: string;
}): React.ReactElement | null {
  // Keyed on the URL, so a new logo gets a fresh attempt.
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const [size, setSize] = useState<{ uri: string; width: number } | null>(null);

  if (logo && logo !== failedLogo) {
    return (
      <View style={{ minHeight: 32, justifyContent: 'center' }}>
        <Image
          source={{ uri: logo }}
          accessibilityRole="image"
          accessibilityLabel={customLogoLabel(companyName)}
          resizeMode="contain"
          style={{
            height: CUSTOM_LOGO_HEIGHT,
            width: size?.uri === logo ? size.width : CUSTOM_LOGO_MAX_WIDTH,
            maxWidth: CUSTOM_LOGO_MAX_WIDTH,
          }}
          onLoad={(e) => {
            const source = e.nativeEvent.source as { width?: number; height?: number } | undefined;
            setSize({ uri: logo, width: customLogoWidth(source?.width, source?.height) });
          }}
          onError={() => setFailedLogo(logo)}
        />
      </View>
    );
  }
  if (!companyName) return null;
  return (
    <MyazaText
      variant="body"
      color={markColor}
      numberOfLines={1}
      style={{ flexShrink: 1, maxWidth: 160, fontSize: 14, fontWeight: '600' }}
    >
      {companyName}
    </MyazaText>
  );
}
