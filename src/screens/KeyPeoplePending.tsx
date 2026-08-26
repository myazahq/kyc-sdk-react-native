import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { useReduceMotion } from '../components/StaggerIn';

/**
 * Held while the register is reconciled against what the applicant typed.
 *
 * A SKELETON of the roster it becomes, not a spinner line (mirrors the web
 * SDK's KeyPeoplePending): ghost cards drawn at the real cards' geometry
 * reserve the space so the answer lands in place, and the shape itself says
 * "a list of people is coming" where a spinner only says "busy". A blank here
 * reads as "nobody needs to verify", the opposite of true. The status line is
 * a polite live region; every shimmer respects the OS reduce-motion setting.
 * Seconds, normally; the hook behind it gives up rather than spinning forever.
 */

/** One shimmering placeholder bar. Static at 70% opacity under reduced motion. */
function GhostBar({
  pulse,
  width,
  height,
  color,
  round,
  style,
}: {
  pulse: Animated.Value | null;
  width: number | `${number}%`;
  height: number;
  color: string;
  round?: boolean;
  style?: object;
}): React.ReactElement {
  return (
    <Animated.View
      style={{
        width,
        height,
        backgroundColor: color,
        borderRadius: round ? radius.full : 4,
        opacity: pulse ?? 0.7,
        ...style,
      }}
    />
  );
}

function GhostCard({
  pulse,
  withLink,
}: {
  pulse: Animated.Value | null;
  withLink?: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <GhostBar pulse={pulse} width="42%" height={14} color={colors.border} />
          <GhostBar
            pulse={pulse}
            width="64%"
            height={10}
            color={colors.border}
            style={{ marginTop: spacing.xs + 2 }}
          />
        </View>
        <GhostBar pulse={pulse} width={76} height={22} color={colors.border} round />
      </View>
      {withLink ? (
        <GhostBar
          pulse={pulse}
          width="100%"
          height={38}
          color={colors.primary100}
          round
          style={{ marginTop: spacing.sm + 4 }}
        />
      ) : null}
    </View>
  );
}

export function KeyPeoplePending(): React.ReactElement {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, { toValue: 0.45, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseValue, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseValue, reduceMotion]);

  const pulse = reduceMotion ? null : pulseValue;

  return (
    <View style={{ width: '100%', marginTop: spacing.lg }}>
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel="Working out who else needs to verify. We are checking the official register for the company's directors and owners."
        style={{ alignItems: 'center', marginBottom: spacing.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <MyazaText variant="bodyMedium" style={{ fontWeight: '600', marginLeft: spacing.sm }}>
            Working out who else needs to verify
          </MyazaText>
        </View>
        {/* Naming the authority is the reassurance: the pause is the official
            register being consulted, not the app hanging. */}
        <MyazaText
          variant="bodySmall"
          color={colors.textMuted}
          style={{ textAlign: 'center', marginTop: spacing.xs }}
        >
          We are checking the official register for the company's directors and owners.
        </MyazaText>
      </View>

      {/* The ghost roster: geometry, not information — hidden from assistive
          tech, the live region above already carries the message. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <GhostBar
          pulse={pulse}
          width={64}
          height={10}
          color={colors.border}
          style={{ marginBottom: spacing.xs + 2 }}
        />
        <GhostCard pulse={pulse} withLink />
        <GhostCard pulse={pulse} />
      </View>
    </View>
  );
}
