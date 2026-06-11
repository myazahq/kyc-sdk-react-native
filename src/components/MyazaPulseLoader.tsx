import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, View } from 'react-native';

import { useTheme } from './runtime';

// Branded loading indicator — the RN mirror of the Flutter SDK's
// `MyazaPulseLoader` (lib/src/widgets/myaza_pulse_loader.dart): a pulsing outer
// ring (border, scale 0.85→1.05 + fade-out, 1s loop) around an inner tinted
// circle holding a spinner. Shared by the ID-type loading state and the
// submitting screen so the loader looks consistent across the flow and matches
// the web/Flutter SDKs.

export interface MyazaPulseLoaderProps {
  /** Outer ring diameter. The inner spinner badge scales to 70% of this. */
  size?: number;
}

export function MyazaPulseLoader({ size = 80 }: MyazaPulseLoaderProps): React.ReactElement {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Outer ring: scales 0.85 → 1.05 while fading 0.8 → 0 (mirrors Flutter's
  // .scale(...).fadeOut(begin: 0.8)).
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.05] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });
  const inner = size * 0.7;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Pulsing outer ring (border only). */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: colors.primary,
          opacity,
          transform: [{ scale }],
        }}
      />
      {/* Inner tinted circle with a spinner. */}
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: `${colors.primary}1A`, // ~10% primary
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    </View>
  );
}
