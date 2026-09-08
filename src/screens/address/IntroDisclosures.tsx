import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { Icon, type IconName } from '../../components/Icon';
import { MyazaText } from '../../components/Typography';
import { useReduceMotion } from '../../components/StaggerIn';

// ---------------------------------------------------------------------------
// The intro screen's three plain-language disclosures — the OkHi-patterned
// consent copy a data protection review asks to see — as a single-open
// accordion.
//
// The body stays MOUNTED inside a clipped Animated.View so its natural height
// can be measured by onLayout and then animated; RN has no auto-height
// transition, and LayoutAnimation needs an experimental opt-in on Android.
// This uses the SDK's own Animated idiom and works the same on both platforms.
//
// Keep this copy in lockstep with the web and Flutter SDKs.
// ---------------------------------------------------------------------------

const HOW_IT_WORKS = {
  foreground:
    'After you finish, your device periodically confirms it is at this address over the coming days. Only day-level summaries ever leave your phone, never your movements.',
  background:
    'After you finish, your phone confirms it is at this address over the coming days, even when the app is closed. Only day-level summaries ever leave your phone, never your movements.',
} as const;

const disclosuresFor = (
  background: boolean,
): Array<{ icon: IconName; title: string; body: string }> => [
  {
    icon: 'circle-help',
    title: 'How it works',
    body: background ? HOW_IT_WORKS.background : HOW_IT_WORKS.foreground,
  },
  {
    icon: 'sliders',
    title: 'You stay in control',
    body: 'You can turn location off at any time in your device settings. An unfinished check simply expires. It never counts against you.',
  },
  {
    icon: 'shield',
    title: 'Your data is protected',
    body: "Location summaries are used only to confirm this address and are handled under your country's data protection rules.",
  },
];

export function IntroDisclosures({
  background = false,
}: {
  /** The workflow opts into OS geofencing: the copy says the app can be closed. */
  background?: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const DISCLOSURES = disclosuresFor(background);
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        overflow: 'hidden',
      }}
    >
      {DISCLOSURES.map((d, i) => (
        <DisclosureRow
          key={d.title}
          icon={d.icon}
          title={d.title}
          body={d.body}
          open={openIdx === i}
          divider={i < DISCLOSURES.length - 1}
          onToggle={() => setOpenIdx(openIdx === i ? null : i)}
        />
      ))}
    </View>
  );
}

function DisclosureRow({
  icon,
  title,
  body,
  open,
  divider,
  onToggle,
}: {
  icon: IconName;
  title: string;
  body: string;
  open: boolean;
  divider: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [bodyHeight, setBodyHeight] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(open ? 1 : 0);
      return;
    }
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 240,
      // Height cannot be driven natively, and the chevron rides the same value
      // so the two stay in step.
      useNativeDriver: false,
    }).start();
  }, [open, progress, reduceMotion]);

  return (
    <View style={divider ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md - 2,
          backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
        })}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.xs,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: open ? colors.primary100 : colors.backgroundSecondary,
          }}
        >
          <Icon name={icon} size={15} color={open ? colors.primary : colors.textSecondary} />
        </View>
        <MyazaText variant="bodyMedium" style={{ flex: 1, fontWeight: '500' }}>
          {title}
        </MyazaText>
        <Animated.View
          style={{
            transform: [
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          }}
        >
          <Icon name="chevron-down" size={16} color={colors.textSecondary} />
        </Animated.View>
      </Pressable>

      <Animated.View
        style={{
          overflow: 'hidden',
          opacity: progress,
          // 0 until the body has been measured, so nothing flashes on the
          // first frame.
          height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, bodyHeight] }),
        }}
      >
        <View
          // Text, never a target — and out of flow it would otherwise sit over
          // the rows below on any platform that declines to clip it.
          pointerEvents="none"
          // POSITIONED ABSOLUTELY, and that is the whole trick. A plain child
          // of this clipped, zero-height box reports its natural height, which
          // is why the pattern looks safe — but TEXT does not: it is measured
          // inside a bounded box, so the available height of zero clamps it to
          // zero. The row then animated open to the padding alone and every
          // disclosure expanded to an empty strip. Out of flow the text is
          // measured with no height constraint at all, so what comes back is
          // the real thing.
          onLayout={(e) => {
            const measured = Math.round(e.nativeEvent.layout.height);
            if (measured > 0 && measured !== bodyHeight) setBodyHeight(measured);
          }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            paddingLeft: spacing.md + 28 + spacing.sm,
            paddingRight: spacing.md,
            paddingBottom: spacing.md,
          }}
        >
          <MyazaText
            variant="bodyMedium"
            color={colors.textSecondary}
            style={{ lineHeight: 21 }}
          >
            {body}
          </MyazaText>
        </View>
      </Animated.View>
    </View>
  );
}
