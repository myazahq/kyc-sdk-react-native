import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { MyazaText } from '../components/Typography';
import { useKyc, useKycStore, useTheme } from '../components/runtime';
import { DashedBorder } from '../components/DashedBorder';
import { spacing } from '../config/theme';

// Dev/sandbox only: pick the canned outcome the register check will serve.
//
// Chosen BEFORE the lookup runs — repeating the control afterwards would offer
// to change an answer that has already come back. Production never shows it
// and never honours a pin if one arrives. Dimensions and motion mirror the web
// SDK's Test-result control: 40px options in a 2px track, and an indicator
// that SLIDES between the two — a block that vanishes here and reappears there
// reads as two separate things blinking; moving it says the selection
// travelled, which is what actually happened.

const OUTCOMES = [
  { key: 'verified', label: 'Verified' },
  { key: 'not_found', label: 'Not found' },
] as const;

export function BusinessSandboxToggle(): React.ReactElement {
  const store = useKycStore();
  const { colors } = useTheme();
  const outcome = useKyc((s) => s.business.sandboxOutcome) || 'verified';
  const [trackWidth, setTrackWidth] = useState(0);
  // Equal columns are what let the indicator translate by exactly its own
  // width. onLayout reports the BORDER box, so both the 1px borders and the
  // 2px padding come off before halving — sizing off the raw width made the
  // slid indicator touch the track's right edge while the left kept its gap.
  const indicatorWidth = Math.max(0, (trackWidth - 2 * 1 - 2 * 2) / 2);
  const slide = useRef(new Animated.Value(outcome === 'verified' ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: outcome === 'verified' ? 0 : 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [outcome, slide]);

  return (
    <View
      style={{
        borderRadius: 12,
        padding: 12,
      }}
    >
      <DashedBorder color={colors.border} radius={12} strokeWidth={1} />
      <MyazaText variant="label">Test result</MyazaText>
      <View style={{ height: spacing.sm }} />
      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={{
          flexDirection: 'row',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 2,
        }}
      >
        {trackWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 2,
              bottom: 2,
              left: 2,
              width: indicatorWidth,
              borderRadius: 6,
              backgroundColor: colors.textDark,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, indicatorWidth],
                  }),
                },
              ],
            }}
          />
        ) : null}
        {OUTCOMES.map(({ key, label }) => {
          const active = outcome === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => store.getState().setBusinessField('sandboxOutcome', key)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 40 }}
            >
              {/* Above the indicator, or the label slides out from under it. */}
              <MyazaText
                variant="bodyMedium"
                color={active ? colors.background : colors.textSecondary}
              >
                {label}
              </MyazaText>
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: spacing.sm }} />
      <MyazaText variant="bodySmall" color={colors.textSecondary}>
        Returned instead of calling the register.
      </MyazaText>
    </View>
  );
}
