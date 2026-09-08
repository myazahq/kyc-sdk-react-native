import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { radius } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { useReduceMotion } from './StaggerIn';

// ─── A text line that is on its way ─────────────────────────────────────────
//
// Drawn at the line's own height so the card around it does not move when the
// words land, and shaped like the answer (a rounded bar about the width of a
// short address) rather than a spinner: a spinner beside grey text says
// "busy", a bar where the text goes says "the line is coming" (user decision
// 2026-09-07). The pin summary and the review card use it while the reverse
// geocode is out. It pulses the way KeyPeoplePending's ghost roster does, so
// the SDK has one skeleton language, and holds still under reduced motion.
// The words still reach assistive tech through the live-region label.
//
// Mirrors the web SDK's components/LineSkeleton and Flutter's
// widgets/line_skeleton.dart.

type Variant = React.ComponentProps<typeof MyazaText>['variant'];

export function LineSkeleton({
  label,
  variant = 'bodyMedium',
  textStyle,
  barHeight = 10,
  width = '62%',
  style,
}: {
  /** What a screen reader hears, e.g. "Finding the address…". */
  label: string;
  /** The variant the real line renders with, so the ghost owns its height. */
  variant?: Variant;
  textStyle?: object;
  barHeight?: number;
  /** How much of the line the bar covers; an address, not a paragraph. */
  width?: number | `${number}%`;
  style?: object;
}): React.ReactElement {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
      style={[{ justifyContent: 'center' }, style]}
    >
      {/* An invisible line in the real variant owns the height, so the card
          does not move when the words replace the bar. */}
      <MyazaText variant={variant} style={[textStyle, { opacity: 0 }]} numberOfLines={1}>
        {' '}
      </MyazaText>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          width,
          height: barHeight,
          borderRadius: radius.full,
          backgroundColor: colors.primary100,
          opacity: reduceMotion ? 0.7 : pulse,
        }}
      />
    </View>
  );
}

/** The resolved line fading in where the skeleton was, so the swap reads as
 *  the answer landing rather than a flicker. Instant under reduced motion. */
export function LineReveal({ children, style }: { children: React.ReactNode; style?: object }): React.ReactElement {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [opacity, reduceMotion]);
  return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}
