import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';

import { useTheme } from '../../components/runtime';
import { useReduceMotion } from '../../components/StaggerIn';
import { MyazaText } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { Pill } from './ImmersiveSurfaces';

// ---------------------------------------------------------------------------
// The instruction over the full-screen camera.
//
// Three things the plain line in the sheet did not need:
//
//  - It is read out. The person is looking at their own face, and somebody
//    using a screen reader cannot see the words at all, so every change is
//    announced: a live region on Android, an announcement on iOS (which has
//    no live regions).
//  - A warning carries a mark as well as its red, and a finished step a tick
//    as well as its green: the colour is never the only signal.
//  - The words change in place: each new line fades in where the last one was.
// ---------------------------------------------------------------------------

export type InstructionTone = 'prompt' | 'warning' | 'done';

export function InstructionPill({
  text,
  tone = 'prompt',
  leading,
}: {
  text: string;
  tone?: InstructionTone;
  /** The gesture's picture, on a phone too short to show it above the pill.
   *  Shown for a prompt only: a warning's mark takes its place. */
  leading?: React.ReactNode;
}): React.ReactElement | null {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const shown = useRef(text);

  useEffect(() => {
    if (shown.current === text) return;
    shown.current = text;
    if (Platform.OS === 'ios' && text) AccessibilityInfo.announceForAccessibility(text);
    if (reduceMotion) return;
    opacity.setValue(0.25);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [text, opacity, reduceMotion]);

  if (!text.trim()) return null;

  const mark =
    tone === 'warning' ? (
      <Icon name="alert" size={20} color={colors.error} />
    ) : tone === 'done' ? (
      <Icon name="circle-check" size={20} color={colors.success} />
    ) : (
      (leading ?? null)
    );

  return (
    <View style={{ alignItems: 'center' }}>
      <Pill>
        <Animated.View
          accessible
          accessibilityRole="text"
          accessibilityLabel={text}
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, opacity }}
        >
          {mark ? <View style={{ marginRight: 8 }}>{mark}</View> : null}
          {/* The green of a finished step does not reach 4.5:1 on a light
              surface, so the tick carries it and the words stay the text
              colour. */}
          <MyazaText
            variant="heading3"
            color={tone === 'warning' ? colors.error : colors.textDark}
            style={{ textAlign: 'center', flexShrink: 1 }}
          >
            {text}
          </MyazaText>
        </Animated.View>
      </Pill>
    </View>
  );
}
