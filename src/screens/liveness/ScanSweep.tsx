import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../../components/runtime';
import type { Size } from '../../lib/livenessCutout';

// ---------------------------------------------------------------------------
// The scan: one pass of light down the window as the photo is taken. It is the
// shutter's follow-through, nothing more: nothing on the phone is examining
// the picture, so it is kept short enough not to look as if something were.
//
// Three layers, as the Flutter SDK paints them (_ScanPainter): a band of light
// trailing the line (what it has just passed over), a soft glow, and a bright
// white core. The glow is a gradient that fades both ways, standing in for
// Flutter's blurred stroke. One view moves, on the native driver.
// ---------------------------------------------------------------------------

export const SCAN_MS = 550;
export const SCAN_DELAY_MS = 150;

/** The band of light behind the line. */
const TRAIL = 90;
/** How far the glow reaches either side of the line. */
const GLOW = 12;
const CORE = 2;

export function ScanSweep({ window }: { window: Size }): React.ReactElement {
  const { colors } = useTheme();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.timing(t, {
      toValue: 1,
      duration: SCAN_MS,
      delay: SCAN_DELAY_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [t]);
  const light = colors.success;
  const height = TRAIL + GLOW;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        // The line sits TRAIL down this view, so it starts on the window's
        // top edge and ends on its bottom one.
        top: -TRAIL,
        width: window.width,
        height,
        // Nothing before the pass begins or after it ends.
        opacity: t.interpolate({ inputRange: [0, 0.02, 0.98, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, window.height] }) }],
      }}
    >
      <Svg width={window.width} height={height}>
        <Defs>
          <LinearGradient id="scanTrail" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={light} stopOpacity={0} />
            <Stop offset="1" stopColor={light} stopOpacity={0.32} />
          </LinearGradient>
          <LinearGradient id="scanGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={light} stopOpacity={0} />
            <Stop offset="0.5" stopColor={light} stopOpacity={0.9} />
            <Stop offset="1" stopColor={light} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={window.width} height={TRAIL} fill="url(#scanTrail)" />
        <Rect x={0} y={TRAIL - GLOW} width={window.width} height={GLOW * 2} fill="url(#scanGlow)" />
        <Rect x={0} y={TRAIL - CORE / 2} width={window.width} height={CORE} fill="#FFFFFF" fillOpacity={0.95} />
      </Svg>
    </Animated.View>
  );
}
