import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

/**
 * Whether the OS asks for reduced motion. Shared by the entrance/skeleton
 * animations so a system-level preference silences all of them at once.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (!cancelled) setReduced(r);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
  return reduced;
}

/**
 * Rise-and-fade entrance for list items, mirroring the web SDK's staggered
 * `animate-slide-up`: each card enters in reading order, ~45ms apart, so a
 * resolved list reads as the skeleton before it settling into place rather
 * than a screen swap. Reduced motion renders children statically.
 */
export function StaggerIn({
  delayMs = 0,
  children,
}: {
  delayMs?: number;
  children: React.ReactNode;
}): React.ReactElement {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 300,
      delay: delayMs,
      useNativeDriver: true,
    }).start();
  }, [progress, delayMs]);

  if (reduceMotion) return <>{children}</>;

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
