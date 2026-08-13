import React from 'react';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../runtime';
import { MyazaText } from '../Typography';
import { Icon } from '../Icon';
import { ChromeGlass } from '../glass/ChromeGlass';

/** This overlay's own scrim, kept so non-glass devices look unchanged. */
const OVERLAY_SCRIM = 'rgba(0,0,0,0.4)';

/** Fills a sized Pressable with a round surface. */
const ROUND_FILL: ViewStyle = {
  flex: 1,
  borderRadius: radius.full,
  alignItems: 'center',
  justifyContent: 'center',
};

/** Top offset that clears the status bar when the camera runs full-bleed. */
export function topInset(fill: boolean): number {
  return fill ? spacing.xl + spacing.md : spacing.md;
}

/**
 * The live instruction from the auto-capture gate.
 *
 * It replaced a static "align your ID" precisely because that told the user
 * nothing about WHICH way to move — and the commonest failure, holding the
 * document too close, is the one nobody guesses. Action hints take the primary
 * colour so they read as something to do.
 */
export function HintBanner({
  text,
  isAction,
  fill,
}: {
  text: string;
  isAction: boolean;
  fill: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={{ position: 'absolute', top: topInset(fill), left: 0, right: 0, alignItems: 'center' }}>
      <View
        style={{
          backgroundColor: isAction ? colors.primary : 'rgba(0,0,0,0.4)',
          paddingHorizontal: spacing.sm + 4,
          paddingVertical: 6,
          borderRadius: radius.full,
          maxWidth: '90%',
        }}
      >
        <MyazaText variant="bodySmall" color="#FFFFFF" style={{ textAlign: 'center' }}>
          {text}
        </MyazaText>
      </View>
    </View>
  );
}

/**
 * A round overlay button — the torch and the immersive back control.
 *
 * Liquid Glass when idle; SOLID brand fill when `active`. An "on" state has to
 * be unmistakable, and a translucent material that samples the scene behind it
 * cannot promise that.
 */
export function OverlayButton({
  icon,
  onPress,
  label,
  active,
  side,
  fill,
}: {
  icon: 'lightbulb' | 'back';
  onPress: () => void;
  label: string;
  active?: boolean;
  side: 'left' | 'right';
  fill: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        position: 'absolute',
        top: topInset(fill),
        [side]: spacing.md,
        width: 36,
        height: 36,
      }}
    >
      {active ? (
        <View style={[ROUND_FILL, { backgroundColor: colors.primary }]}>
          <Icon name={icon} size={18} color="#FFFFFF" />
        </View>
      ) : (
        <ChromeGlass interactive scrim={OVERLAY_SCRIM} style={ROUND_FILL}>
          <Icon name={icon} size={18} color="#FFFFFF" />
        </ChromeGlass>
      )}
    </Pressable>
  );
}

/**
 * The shutter, with the stability dwell drawn around it.
 *
 * The ring is what tells a user who is holding steady that something is
 * happening — without it, auto-capture looks like a camera doing nothing right
 * up until it fires.
 */
export function Shutter({
  onPress,
  ready,
  busy,
  progress,
}: {
  onPress: () => void;
  ready: boolean;
  busy: boolean;
  progress: number;
}): React.ReactElement {
  const { colors } = useTheme();
  const R = 36;
  const CIRC = 2 * Math.PI * R;

  return (
    <View style={{ position: 'absolute', bottom: spacing.lg, left: 0, right: 0, alignItems: 'center' }}>
      {progress > 0 && progress < 1 ? (
        <Svg width={80} height={80} style={{ position: 'absolute', bottom: -8 }}>
          <Circle cx={40} cy={40} r={R} stroke="rgba(255,255,255,0.25)" strokeWidth={3} fill="none" />
          <Circle
            cx={40}
            cy={40}
            r={R}
            stroke={colors.primary}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            transform="rotate(-90 40 40)"
          />
        </Svg>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={busy || !ready}
        accessibilityRole="button"
        accessibilityLabel="Capture photo"
        style={({ pressed }) => ({
          width: 64,
          height: 64,
          borderRadius: radius.full,
          backgroundColor: ready ? '#FFFFFF' : colors.gray400,
          borderWidth: 4,
          borderColor: ready ? colors.primary : colors.gray300,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        {busy ? <ActivityIndicator color={colors.primary} /> : <Icon name="camera" size={24} color={ready ? colors.primary : '#FFFFFF'} />}
      </Pressable>
    </View>
  );
}
