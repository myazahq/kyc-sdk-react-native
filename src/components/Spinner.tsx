import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from './runtime';
import { SPINNER_PATH, SPINNER_STROKE, SPINNER_TURN_MS, spinnerSize } from './spinnerShape';

// ---------------------------------------------------------------------------
// THE loading spinner, everywhere in the SDK: the same hooked arc the web SDK
// and the dashboard spin (their `Loader2`, Hugeicons' Loading02), turning once
// a second.
//
// It replaces the platform's own indicator, which is a different drawing on
// iOS and on Android and neither of them is the one the web shows, and the
// pulsing ring some screens used. One flow should wait the same way on every
// surface an organisation puts it on.
//
// The props are the ones the platform indicator took (`size`, `color`), so a
// screen swaps the tag and nothing else.
//
// The drawing itself is components/spinnerShape.ts.
// ---------------------------------------------------------------------------

export interface SpinnerProps {
  size?: number | 'small' | 'large';
  /** Defaults to the flow's primary colour. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function Spinner({ size, color, style }: SpinnerProps): React.ReactElement {
  const { colors } = useTheme();
  const turn = useRef(new Animated.Value(0)).current;
  const side = spinnerSize(size);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: SPINNER_TURN_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[{ width: side, height: side, alignSelf: 'center', transform: [{ rotate }] }, style]}
    >
      <Svg width={side} height={side} viewBox="0 0 24 24" fill="none">
        <Path d={SPINNER_PATH} stroke={color ?? colors.primary} strokeWidth={SPINNER_STROKE} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
