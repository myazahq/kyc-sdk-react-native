import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { radius, spacing } from '../config/theme';
import { PRIVACY_URL, TERMS_URL } from '../config/brand';
import { useKyc, useKycConfig, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { Icon } from '../components/Icon';
import { buildConsentModel } from './consent/model';

// Consent / welcome screen — 1:1 with the web SDK's ConsentStep and the
// Flutter SDK's ConsentScreen: shield hero, token-filled greeting, a "DURING
// THIS PROCESS WE WILL" card, the derived legal notice, Continue, lock footer.
// Everything the screen SAYS — title, description, step list, the biometric
// sentence — is derived in consent/model.ts from what the flow actually does,
// so a KYB flow gets the business copy and never claims an ID/selfie step it
// doesn't run. The header title is intentionally empty for this step; the
// screen owns its hero.

export function ConsentStep(): React.ReactElement {
  const { colors } = useTheme();
  const config = useKycConfig();
  const nextStep = useKyc((s) => s.nextStep);

  const { isBusiness, title, description, steps, capturesFace, recordsVideo } =
    buildConsentModel(config);

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
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.primary,
              shadowOpacity: 0.3,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            {/* Top-left → bottom-right gradient badge, matching Flutter. A flat
                fill was the last visual difference on this screen. The second
                stop is the SAME primary at 70% opacity rather than a
                pre-blended colour: composited over the sheet it produces
                Flutter's `alphaBlend(primary@0.7, background)` exactly, and it
                keeps working when the consumer overrides primaryColor or the
                theme flips, which a hardcoded blend would not. */}
            <Svg width={56} height={56} style={{ position: 'absolute' }}>
              <Defs>
                <LinearGradient id="myazaShieldHero" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity={1} />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity={0.7} />
                </LinearGradient>
              </Defs>
              <Circle cx={28} cy={28} r={28} fill="url(#myazaShieldHero)" />
            </Svg>
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
      {/* Consent is given by ACTING now, so the notice sits immediately above
          the button it describes — adjacency is what makes it informed.
          The biometric sentence is DERIVED: claiming facial recognition on a
          flow with no selfie step would be false, and recording video without
          saying so is the failure that actually matters. */}
      <MyazaText variant="bodySmall" style={{ lineHeight: 18 }}>
        By tapping Continue, you agree to the{' '}
        <MyazaText
          variant="bodySmall"
          color={colors.textDark}
          style={{ fontWeight: '600', textDecorationLine: 'underline' }}
          onPress={() => void Linking.openURL(TERMS_URL).catch(() => undefined)}
        >
          End User Terms
        </MyazaText>{' '}
        and{' '}
        <MyazaText
          variant="bodySmall"
          color={colors.textDark}
          style={{ fontWeight: '600', textDecorationLine: 'underline' }}
          onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => undefined)}
        >
          Privacy Policy
        </MyazaText>
        , and consent to your {isBusiness ? 'business and personal data' : 'personal data'} being
        processed to verify your identity.
        {capturesFace
          ? ' This includes facial recognition and recording this session.'
          : recordsVideo
            ? ' This includes recording this session.'
            : ''}
      </MyazaText>

      <View style={{ height: spacing.lg }} />
      <MyazaButton label="Continue" onPress={nextStep} />
      <View style={{ height: spacing.sm }} />

      {/* Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock" size={13} color={colors.textMuted} />
        <View style={{ width: 6 }} />
        {/* flexShrink so a wide brand font wraps this instead of clipping it —
            a Text in a row without it overflows rather than wrapping. */}
        <MyazaText variant="bodySmall" style={{ flexShrink: 1 }}>
          Your data is encrypted and securely processed
        </MyazaText>
      </View>
    </View>
  );
}
