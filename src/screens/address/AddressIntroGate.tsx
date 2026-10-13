import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useFlowState, useVerificationConfig, useVerificationStore, useTheme } from '../../components/runtime';
import { UiText } from '../../components/Typography';
import { UiButton } from '../../components/UiButton';
import { Icon } from '../../components/Icon';
import { MilestoneTrack, type Milestone } from '../../components/MilestoneTrack';
import { IntroDisclosures } from './IntroDisclosures';
import type { VerificationStep } from '../../types/config';
import { useText } from '../../i18n/useText';
import type { TextFn } from '../../i18n/types';

// ---------------------------------------------------------------------------
// The presence "how it works" screen, shown ONCE before the address flow's
// first step. Drawn in the SUCCESS CARD's language — eyebrow pill, header band,
// milestone track — so the promise made here and the "address check active"
// card at the end read as two frames of one story.
//
// The underlying step still does its mount work behind this gate: the
// current-fix prefetch starts while the primer is on screen, so by the time
// "Continue" is tapped the fix is usually already in hand and the pin lands with
// no hesitation. Only the APPLY waits.
// ---------------------------------------------------------------------------

// The second milestone's caption depends on which tier the org runs. With
// background geofencing on, the "allow all the time" prompt is coming, and
// OkHi's integration guidance is to say so ONCE, up front, beside the
// education — not to surprise the person with it after capture.
const milestonesFor = (background: boolean, t: TextFn): readonly Milestone[] => [
  {
    icon: 'map-pin-house',
    stage: t('address.intro.step1.stage'),
    title: t('address.intro.step1.title'),
    caption: t('address.intro.step1.caption'),
    state: 'active',
  },
  {
    icon: 'radar',
    stage: t('address.intro.step2.stage'),
    title: t('address.intro.step2.title'),
    caption: t(background ? 'address.intro.step2.caption.background' : 'address.intro.step2.caption'),
    state: 'ahead',
  },
  {
    icon: 'bell-ring',
    stage: t('address.intro.step3.stage'),
    title: t('address.intro.step3.title'),
    caption: t('address.intro.step3.caption'),
    state: 'ahead',
  },
];

/**
 * The gate for `step`, or null when it should not show. Returning the element
 * (rather than a boolean) keeps the decision and the screen in one place: a
 * step renders `gate ?? its own body`.
 */
export function useAddressIntroGate(
  step: VerificationStep,
  firstStep: VerificationStep,
): React.ReactElement | null {
  const config = useVerificationConfig();
  const store = useVerificationStore();
  const { colors } = useTheme();
  const t = useText();
  const seen = useFlowState((s) => s.addressIntroSeen);
  const presence = config.addressCollection?.presence?.enabled === true;
  // Background monitoring is on unless the workflow turns it off.
  const background = config.addressCollection?.presence?.background !== false;

  if (step !== firstStep || !presence || seen) return null;

  return (
    <View>
      {/* Web's exact tints (border-primary/15, bg-primary/[0.06], the badge
          on primary/10), as hex alpha on the primary so a custom brand and
          dark mode both keep the relationship; Flutter draws the same. */}
      <View
        style={{
          borderWidth: 1,
          borderColor: `${colors.primary}26`,
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            backgroundColor: `${colors.primary}0F`,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm + 4,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: spacing.sm,
              paddingHorizontal: spacing.sm + 2,
              paddingVertical: 4,
              borderRadius: radius.full,
              backgroundColor: `${colors.primary}1A`,
            }}
          >
            <Icon name="map-pin-check" size={12} color={colors.primary} />
            <UiText
              variant="bodySmall"
              color={colors.primary}
              style={{
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              {t('address.intro.badge')}
            </UiText>
          </View>
          {/* Web's `text-base font-semibold`: the BODY face at 16/600, not a
              heading, so it matches the review card's address line. */}
          <UiText variant="body" style={{ marginTop: spacing.sm, fontWeight: '600' }}>
            {t('address.intro.title')}
          </UiText>
          <UiText variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 2 }}>
            {t('address.intro.description')}
          </UiText>
        </View>

        <MilestoneTrack milestones={milestonesFor(background, t)} numbered />
      </View>

      <View style={{ height: spacing.md }} />
      <IntroDisclosures background={background} />

      <View style={{ height: spacing.lg }} />
      <UiButton
        label={t('address.intro.start')}
        onPress={() => store.getState().markAddressIntroSeen()}
      />
    </View>
  );
}
