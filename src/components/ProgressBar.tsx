import React, { useEffect, useRef } from 'react';
import { Animated, Easing, useAnimatedValue, View } from 'react-native';

import { useTheme } from './runtime';

// The quiet alternative to StepIndicator: a single thin bar sitting ON the
// header's bottom edge, replacing its border rather than adding a row beneath
// it — so choosing it costs the header no height at all.
//
// Unlike the step circles it does not say WHICH step you are on or how many
// there are, which is the trade: it is unaffected by step count, so a 14-step
// KYB flow draws exactly like a 4-step one. Hosts who would rather the chrome
// said less opt in with `progressStyle: 'bar'`.

export interface ProgressBarProps {
  /** 0.0–1.0 progress fraction. */
  progress: number;
  /** Steps in the flow — announced, not drawn. */
  stepCount: number;
}

/**
 * Thickness of the bar.
 *
 * 5, not the 1px border it replaces: at hairline weight it read as a rendering
 * artefact rather than a deliberate indicator, and the filled portion needs
 * enough body for its colour to register against the track at a glance.
 */
const HEIGHT = 5;

export function ProgressBar({ progress, stepCount }: ProgressBarProps): React.ReactElement {
  const { colors } = useTheme();
  const fraction = Math.min(Math.max(progress, 0), 1);
  const step = Math.min(Math.max(Math.round(fraction * stepCount), 1), stepCount);

  // Animated so advancing a step reads as movement rather than a jump — the
  // motion IS the feedback that the step was accepted. 250ms sits inside the
  // 150–300ms micro-interaction band; ease-out because it is entering.
  const width = useAnimatedValue(fraction);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      // Don't animate the initial mount from 0 — the flow may be resumed
      // mid-way, and a bar sweeping in from empty would misreport where the
      // user actually is.
      first.current = false;
      width.setValue(fraction);
      return;
    }
    Animated.timing(width, {
      toValue: fraction,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      // Width cannot be driven natively, and a scaleX transform would squash
      // the rounded cap. The bar is one small view, so the JS driver is fine.
      useNativeDriver: false,
    }).start();
  }, [fraction, width]);

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: HEIGHT,
        // The track doubles as the header's bottom border, which is why the
        // header drops its own when this is shown.
        backgroundColor: colors.border,
      }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${stepCount}`}
      accessibilityValue={{ min: 1, max: stepCount, now: step }}
    >
      <Animated.View
        style={{
          height: HEIGHT,
          backgroundColor: colors.primary,
          borderTopRightRadius: HEIGHT / 2,
          borderBottomRightRadius: HEIGHT / 2,
          width: width.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}
