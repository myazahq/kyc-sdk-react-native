import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { MyazaText } from './Typography';
import { MilestoneTrack, type Milestone } from './MilestoneTrack';
import { useReduceMotion } from './StaggerIn';
import { radius, spacing } from '../config/theme';
import { useTheme } from './theme-provider';

// ---------------------------------------------------------------------------
// The success screen's presence card, drawn as a LIVE PROCESS rather than a
// notice: the check began the moment they submitted, so the card should feel
// like something is already quietly working, because it is.
//
// Its milestones are the same three the intro gate promises, one frame later —
// keep the two, and the web and Flutter SDKs, in lockstep.
//
// The standalone "presence consent notice" that used to live here is gone: the
// disclosures belong on the intro gate, and a second copy on the address step
// was one more place for the consent wording to drift.
// ---------------------------------------------------------------------------

const MILESTONES: readonly Milestone[] = [
  {
    icon: 'map-pin-check',
    stage: 'Today',
    title: 'Check started',
    caption: 'Your pin is saved. Keep location on.',
    state: 'active',
  },
  {
    icon: 'radar',
    stage: 'Next few days',
    title: 'Quiet check-ins',
    caption: 'Your phone confirms it is at your address now and then.',
    state: 'ahead',
  },
  {
    icon: 'bell-ring',
    stage: 'Then',
    title: 'Confirmed',
    caption: 'You get a notification. That is it.',
    state: 'ahead',
  },
];

export function PresenceExpectations(): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'stretch',
        marginTop: spacing.lg,
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
          <LiveDot />
          <MyazaText
            variant="bodySmall"
            color={colors.primary}
            style={{
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Address check active
          </MyazaText>
        </View>
        <MyazaText variant="bodyMedium" style={{ fontWeight: '600', marginTop: spacing.sm }}>
          Your address confirms itself from here
        </MyazaText>
        <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 2 }}>
          Nothing else for you to do. Carry on as normal.
        </MyazaText>
      </View>

      {/* Web's h-8 nodes here, against the primer's h-10. */}
      <MilestoneTrack milestones={MILESTONES} nodeSize={32} />
    </View>
  );
}

/** The badge's pulse — the one thing on the card that says "running now". */
function LiveDot(): React.ReactElement {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
      {reduceMotion ? null : (
        <Animated.View
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: radius.full,
            backgroundColor: colors.primary,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) },
            ],
          }}
        />
      )}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: radius.full,
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}
