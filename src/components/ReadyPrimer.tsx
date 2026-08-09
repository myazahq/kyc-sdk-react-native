import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { MyazaButton } from './MyazaButton';
import { Icon } from './Icon';
import type { ReadyContent } from './readyPrimerContent';

// ---------------------------------------------------------------------------
// "Here's what happens next" — shown once before a capture step opens the
// camera.
//
// It exists because the camera used to appear unannounced: a user who does not
// know their ID or their face is about to be photographed fumbles the first
// attempt, and a retake costs more than a sentence of warning.
//
// It sits BEFORE the camera-permission primer: first what we are about to do,
// then the OS prompt. Two asks in a row, each with a reason, never a surprise.
//
// A port of the Flutter SDK's ReadyPrimer and the web SDK's — same single-column
// shape (one hero, at most three expectations, one primary action) and the same
// copy, so the flow reads identically whichever SDK an org embeds.
// ---------------------------------------------------------------------------

export function ReadyPrimer({
  content,
  onReady,
  buttonLabel = "I'm ready",
}: {
  content: ReadyContent;
  onReady: () => void;
  buttonLabel?: string;
}): React.ReactElement {
  const { colors } = useTheme();

  return (
    // TOP-ALIGNED, like the web and Flutter. The sheet body guarantees the
    // child at least the viewport height, so centring parked the whole primer
    // in the middle and left a dead band under the step indicator.
    <ScrollView
      contentContainerStyle={{ paddingVertical: spacing.md }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero — matches the permission primer's icon treatment so the two
          screens read as one sequence rather than two different designs. */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingVertical: 36,
          backgroundColor: `${colors.primary}0D`, // 5%
          borderWidth: 1,
          borderColor: `${colors.primary}26`, // 15%
          borderRadius: radius.lg,
          alignItems: 'center',
        }}
      >
        <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRing color={colors.primary} />
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: `${colors.primary}26`, // 15%
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={content.icon} size={28} color={colors.primary} />
          </View>
        </View>

        <View style={{ height: spacing.md }} />
        <MyazaText variant="heading3" style={{ textAlign: 'center' }}>
          {content.title}
        </MyazaText>
        <View style={{ height: 6 }} />
        <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          {content.body}
        </MyazaText>
      </View>

      <View style={{ height: 20 }} />

      {/* Expectations — the same row idiom as the consent screen's
          "during this process we will" list. */}
      {content.checklist.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.xs,
              backgroundColor: `${colors.primary}1A`, // 10%
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={item.icon} size={18} color={colors.primary} />
          </View>
          <View style={{ width: 12 }} />
          <MyazaText variant="bodyMedium" style={{ flex: 1 }}>
            {item.label}
          </MyazaText>
        </View>
      ))}

      <View style={{ height: 8 }} />
      {/* One primary action. MyazaButton already clears the 44pt minimum. */}
      <MyazaButton label={buttonLabel} onPress={onReady} />
    </ScrollView>
  );
}

/** The web's `animate-pulse-ring` — a ring that expands and fades behind the glyph. */
function PulseRing({ color }: { color: string }): React.ReactElement {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: color,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
      }}
    />
  );
}
