import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useKyc, useKycConfig, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { Icon, type IconName } from '../components/Icon';
import { fillTokens } from '../utils/tokens';

// Consent / welcome screen — 1:1 with the Flutter SDK's ConsentScreen:
// shield hero, token-filled greeting, a "DURING THIS PROCESS WE WILL" card,
// a consent checkbox (must agree), Continue (gated on agreement), lock footer.
// The header title is intentionally empty for this step; the screen owns its hero.

const DEFAULT_DESCRIPTION =
  'We need to verify your identity to comply with regulatory requirements. This process is quick and secure.';

interface ProcessStep {
  icon: IconName;
  label: string;
}

export function ConsentStep(): React.ReactElement {
  const { colors } = useTheme();
  const config = useKycConfig();
  const nextStep = useKyc((s) => s.nextStep);
  const [agreed, setAgreed] = useState(false);

  const firstName = config.userData?.firstName ?? '';
  const title = config.consent?.title
    ? fillTokens(config.consent.title, config.userData)
    : firstName
      ? `Welcome, ${firstName}`
      : 'Identity Verification';
  const description = config.consent?.description
    ? fillTokens(config.consent.description, config.userData)
    : DEFAULT_DESCRIPTION;

  const steps: ProcessStep[] = [
    { icon: 'badge-check', label: 'Verify your government-issued ID' },
    { icon: 'user', label: 'Collect basic personal information' },
    ...(config.enableDocumentCapture
      ? [{ icon: 'scan-line' as IconName, label: 'Capture a photo of your ID document' }]
      : []),
    ...(config.enableSelfie
      ? [{ icon: 'scan-face' as IconName, label: 'Take a selfie for facial verification' }]
      : []),
  ];

  return (
    <View>
      <View style={{ height: spacing.sm }} />

      {/* Shield hero — concentric tinted rings + primary badge */}
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: `${colors.primary}1A` }} />
          <View style={{ position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.primary}26` }} />
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.primary,
              shadowOpacity: 0.3,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <Icon name="shield" size={28} color={colors.onPrimary} />
          </View>
        </View>
      </View>

      <View style={{ height: spacing.lg }} />
      <MyazaText variant="heading1" style={{ textAlign: 'center' }}>
        {title}
      </MyazaText>
      <View style={{ height: spacing.sm }} />
      <MyazaText variant="bodyMedium" style={{ textAlign: 'center' }}>
        {description}
      </MyazaText>
      <View style={{ height: spacing.lg }} />

      {/* Process steps card */}
      <View style={{ backgroundColor: colors.backgroundSecondary, borderRadius: radius.lg, padding: spacing.md + 4 }}>
        <MyazaText variant="bodySmall" color={colors.textMuted} style={{ fontWeight: '600', letterSpacing: 0.5 }}>
          DURING THIS PROCESS WE WILL
        </MyazaText>
        <View style={{ height: spacing.md }} />
        {steps.map((step, i) => (
          <View key={step.label} style={{ flexDirection: 'row', alignItems: 'center', marginTop: i > 0 ? 14 : 0 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.xs,
                backgroundColor: `${colors.primary}1A`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={step.icon} size={18} color={colors.primary} />
            </View>
            <View style={{ width: spacing.sm + 4 }} />
            <MyazaText variant="bodyMedium" color={colors.textDark} style={{ flex: 1, fontWeight: '600' }}>
              {step.label}
            </MyazaText>
          </View>
        ))}
      </View>

      <View style={{ height: spacing.lg }} />

      {/* Consent checkbox */}
      <Pressable
        onPress={() => setAgreed((v) => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          padding: spacing.md,
          borderRadius: radius.sm,
          backgroundColor: agreed ? `${colors.primary}0F` : colors.backgroundSecondary,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.xs - 2,
            backgroundColor: agreed ? colors.primary : 'transparent',
            borderWidth: 1.5,
            borderColor: agreed ? colors.primary : colors.gray400,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          {agreed ? <Icon name="check" size={14} color={colors.onPrimary} /> : null}
        </View>
        <View style={{ width: spacing.sm + 2 }} />
        <MyazaText variant="bodyMedium" color={colors.textDark} style={{ flex: 1, fontWeight: '600' }}>
          I consent to the collection and processing of my personal data for identity verification purposes.
        </MyazaText>
      </Pressable>

      <View style={{ height: spacing.lg }} />
      <MyazaButton label="Continue" onPress={agreed ? nextStep : undefined} disabled={!agreed} />
      <View style={{ height: spacing.sm }} />

      {/* Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock" size={13} color={colors.textMuted} />
        <View style={{ width: 6 }} />
        <MyazaText variant="bodySmall">Your data is encrypted and securely processed</MyazaText>
      </View>
    </View>
  );
}
