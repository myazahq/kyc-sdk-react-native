import React from 'react';
import { Linking } from 'react-native';

import { PRIVACY_URL, TERMS_URL } from '../../config/brand';
import { useKyc, useKycConfig, useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { consentLegalNotice, PRIVACY_LABEL, TERMS_LABEL } from './legal';

// The consent notice above Continue. Consent is given by ACTING now, so the
// notice sits immediately above the button it describes: adjacency is what
// makes it informed. The biometric sentence is DERIVED (consent/model.ts), and
// the Myaza Trust disclosure appears only when the org's own logo replaces
// Myaza's in the footer (consent/legal.ts).

export function ConsentLegalNotice({
  isBusiness,
  capturesFace,
  recordsVideo,
}: {
  isBusiness: boolean;
  capturesFace: boolean;
  recordsVideo: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  const config = useKycConfig();
  const branding = useKyc((s) => s.serverConfig.branding);
  const parts = consentLegalNotice({
    isBusiness,
    capturesFace,
    recordsVideo,
    attribution: branding?.trustAttribution,
    workflowCompanyName: config.appearance?.companyName,
    brandingCompanyName: branding?.companyName,
  });
  const link = (label: string, url: string, key: number): React.ReactElement => (
    <MyazaText
      key={key}
      variant="bodySmall"
      color={colors.textDark}
      style={{ fontWeight: '500', textDecorationLine: 'underline' }}
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
    >
      {label}
    </MyazaText>
  );

  return (
    <MyazaText variant="bodySmall" style={{ lineHeight: 18 }}>
      {parts.map((part, i) =>
        part.kind === 'terms'
          ? link(TERMS_LABEL, TERMS_URL, i)
          : part.kind === 'privacy'
            ? link(PRIVACY_LABEL, PRIVACY_URL, i)
            : part.text,
      )}
    </MyazaText>
  );
}
