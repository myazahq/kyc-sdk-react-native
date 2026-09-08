import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { MyazaText } from '../../components/Typography';
import { Icon, type IconName } from '../../components/Icon';
import { useKyc, useKycStore, useTheme } from '../../components/runtime';
import { DashedBorder } from '../../components/DashedBorder';
import { spacing } from '../../config/theme';

// Dev/sandbox only: the address flow's Test-result tabs — the web SDK's
// control, on the BusinessSandboxToggle's mechanics. Four equal columns share
// one sliding indicator whose FILL takes the active outcome's semantic colour
// (the dashboard's tier/verdict language), so moving from Attested to
// Mismatch reads as one pill travelling and turning red. Tabs are icon-only
// (four labels never fit a phone) and the caption names the active pick.
// Nothing is SENT until the operator taps; unclicked keeps the server default,
// which the resting position mirrors.

type Outcome =
  | 'address_attested'
  | 'address_corroborated'
  | 'address_collected'
  | 'address_mismatch';

// `tint` is the icon's own colour while the tab is INACTIVE, so the row reads
// as four outcomes rather than one live state and three dead ones. The pairs
// are web's `text-emerald-600 dark:text-emerald-400` and friends, hex for hex;
// `null` takes the theme's muted tone, web's `text-muted-foreground`.
const OPTIONS: Array<{
  key: Outcome;
  label: string;
  icon: IconName;
  pill: string;
  tint: { light: string; dark: string } | null;
}> = [
  {
    key: 'address_attested',
    label: 'Attested',
    icon: 'shield',
    pill: '#059669',
    tint: { light: '#059669', dark: '#34d399' },
  },
  {
    key: 'address_corroborated',
    label: 'Corroborated',
    icon: 'badge-check',
    pill: '#0284c7',
    tint: { light: '#0284c7', dark: '#38bdf8' },
  },
  {
    key: 'address_collected',
    label: 'Collected',
    icon: 'circle-dashed',
    pill: '#475569',
    tint: null,
  },
  {
    key: 'address_mismatch',
    label: 'Mismatch',
    icon: 'circle-x',
    pill: '#dc2626',
    tint: { light: '#dc2626', dark: '#f87171' },
  },
];

export function AddressSandboxTabs(): React.ReactElement | null {
  const store = useKycStore();
  const { colors, mode } = useTheme();
  const environment = useKyc((s) => s.serverConfig.environment);
  const picked = useKyc((s) => s.addressSandboxOutcome);
  const shown = picked ?? 'address_attested';
  const index = Math.max(0, OPTIONS.findIndex((o) => o.key === shown));
  const [trackWidth, setTrackWidth] = useState(0);
  // Border box minus borders and padding, quartered — the business toggle's
  // measurement rule, for four columns.
  const indicatorWidth = Math.max(0, (trackWidth - 2 * 1 - 2 * 2) / 4);
  const slide = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: index,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [index, slide]);

  if (environment === 'PRODUCTION') return null;

  return (
    <View style={{ borderRadius: 12, padding: 12 }}>
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
              backgroundColor: OPTIONS[index]!.pill,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, OPTIONS.length - 1],
                    outputRange: [0, indicatorWidth * (OPTIONS.length - 1)],
                  }),
                },
              ],
            }}
          />
        ) : null}
        {OPTIONS.map(({ key, label, icon, tint }, i) => {
          const active = index === i;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => store.getState().setAddressSandboxOutcome(key)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 40 }}
            >
              {/* Above the indicator, or the icon slides out from under it. */}
              <Icon
                name={icon}
                size={18}
                color={
                  active
                    ? '#ffffff'
                    : (tint ? tint[mode === 'dark' ? 'dark' : 'light'] : colors.textSecondary)
                }
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: spacing.sm }} />
      <MyazaText variant="bodySmall" color={colors.textSecondary}>
        {OPTIONS[index]!.label} is returned instead of judging the pin.
      </MyazaText>
    </View>
  );
}
