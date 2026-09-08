import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { StyleAbsFill } from './constants';

// The shutter: a white flash over the camera circle as the still is taken,
// fading out over the beat the ring takes to close and go green. Mirrors the
// web SDK's animate-capture-flash (600ms ease-out). Core Animated on the
// native driver — opacity only — is the same recipe LightingBanner uses.
export function ShutterFlash() {
  const opacity = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [opacity]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleAbsFill, { backgroundColor: '#FFFFFF', opacity }]}
    />
  );
}
