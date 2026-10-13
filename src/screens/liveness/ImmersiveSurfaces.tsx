import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, type ViewStyle } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { useReduceMotion } from '../../components/StaggerIn';
import { UiText } from '../../components/Typography';
import { Icon } from '../../components/Icon';

// ---------------------------------------------------------------------------
// Surfaces for content over the camera.
//
// The room behind the camera can be any colour, so words never sit on it
// directly: each carries its own surface. Solid, in the flow's background
// colour, with its border: there is no blur to frost them with here.
// ---------------------------------------------------------------------------

/** One line fills the ends fully round; a wrapped second line keeps soft
 *  corners instead of being squeezed into a capsule. */
const PILL_RADIUS = 24;

export function Pill({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: PILL_RADIUS,
          paddingHorizontal: 18,
          paddingVertical: 10,
          maxWidth: '100%',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Panel({ children }: { children: React.ReactNode }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        alignSelf: 'stretch',
      }}
    >
      {children}
    </View>
  );
}

/**
 * The line on the bottom edge: what happens to the picture being taken.
 *
 * Shown from the moment the camera opens until the photo is taken, then it
 * fades out. It is one quiet line in the secondary text colour, so it does not
 * compete with the instruction above the window.
 */
export function Reassurance({ visible = true }: { visible?: boolean }): React.ReactElement {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, opacity, reduceMotion]);
  return (
    <Animated.View
      style={{ opacity }}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <Pill>
        <Icon name="lock" size={13} color={colors.textSecondary} />
        <View style={{ width: 6 }} />
        <UiText variant="bodySmall" color={colors.textSecondary} style={{ flexShrink: 1 }}>
          Your selfie is sent over a secure connection
        </UiText>
      </Pill>
    </Animated.View>
  );
}

/** How far through the gestures the person is, under the window: what the row
 *  of dots says in the sheet, in words. */
export function StepCount({ step, total }: { step: number; total: number }): React.ReactElement {
  return (
    <View style={{ alignItems: 'center' }}>
      <Pill>
        <UiText variant="bodySmall" style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {`Step ${step} of ${total}`}
        </UiText>
      </Pill>
    </View>
  );
}

/**
 * The plate the gesture animation sits on over the camera: a solid white disc
 * with a ring and a shadow, so the cartoon reads against any room. `compact`
 * is the one inside the instruction's pill on a short phone: a thinner ring
 * and no shadow, since the pill is already its surface.
 */
export function GesturePlate({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          padding: compact ? 2 : 4,
          borderRadius: radius.full,
          backgroundColor: '#FFFFFF',
          borderWidth: compact ? 1.5 : 2,
          borderColor: colors.primary,
          overflow: 'hidden',
        },
        compact
          ? null
          : {
              shadowColor: '#000000',
              shadowOpacity: 0.25,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
              overflow: 'visible',
            },
      ]}
    >
      {children}
    </View>
  );
}
