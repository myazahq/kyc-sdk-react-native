import React from 'react';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../runtime';
import { MyazaText } from '../Typography';
import { Icon } from '../Icon';
import { CHROME_SCRIM, ChromeGlass } from '../glass/ChromeGlass';

const SCRIM = CHROME_SCRIM;

/** The torch's own scrim, kept as-is so non-glass devices look unchanged. */
const TORCH_SCRIM = 'rgba(0,0,0,0.45)';

/** Fills a sized Pressable with a round surface. */
const ROUND_FILL: ViewStyle = {
  flex: 1,
  borderRadius: radius.full,
  alignItems: 'center',
  justifyContent: 'center',
};

/**
 * Fixed slots either side of the shutter.
 *
 * The torch is a CAPTURE control, so it sits beside the shutter where the thumb
 * already is — not out in a corner. Equal slots keep the shutter centred
 * whether or not the device has a flash unit to show.
 */
const SIDE_SLOT = 72;

/** Hint + upload escape + shutter + torch, stacked at the bottom. */
export function BottomBar({
  hint,
  hintIsAction,
  allowUpload,
  onUpload,
  onCapture,
  busy,
  ready,
  progress,
  hasTorch,
  torch,
  onToggleTorch,
  bottomInset,
}: {
  hint: string;
  hintIsAction: boolean;
  allowUpload: boolean;
  onUpload: () => void;
  onCapture: () => void;
  busy: boolean;
  ready: boolean;
  progress: number;
  hasTorch: boolean;
  torch: boolean;
  onToggleTorch: () => void;
  bottomInset: number;
}): React.ReactElement {
  const { colors } = useTheme();
  const R = 40;
  const CIRC = 2 * Math.PI * R;

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomInset + spacing.lg,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          backgroundColor: hintIsAction ? colors.primary : SCRIM,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          maxWidth: '92%',
        }}
      >
        <MyazaText variant="bodyMedium" color="#FFFFFF" style={{ textAlign: 'center' }}>
          {hint}
        </MyazaText>
      </View>

      {allowUpload ? (
        <Pressable onPress={onUpload} style={{ marginTop: spacing.md }} accessibilityRole="button">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="upload" size={18} color="#FFFFFF" />
            <View style={{ width: 8 }} />
            <MyazaText variant="bodyMedium" color="#FFFFFF">
              Upload a photo instead
            </MyazaText>
          </View>
        </Pressable>
      ) : null}

      <View style={{ height: spacing.md }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }}>
        <View style={{ width: SIDE_SLOT }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          {/* The dwell, drawn around the shutter — a user holding steady can see
              it working instead of wondering whether to press. */}
          {progress > 0 && progress < 1 ? (
            <Svg width={88} height={88} style={{ position: 'absolute', top: -4 }}>
              <Circle
                cx={44}
                cy={44}
                r={R}
                stroke={colors.primary}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress)}
                transform="rotate(-90 44 44)"
              />
            </Svg>
          ) : null}
          <Pressable
            onPress={onCapture}
            disabled={busy || !ready}
            accessibilityRole="button"
            accessibilityLabel="Capture photo"
            style={({ pressed }) => ({
              width: 80,
              height: 80,
              borderRadius: radius.full,
              borderWidth: 4,
              borderColor: '#FFFFFF',
              backgroundColor: 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.6 : 1,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <View
              style={{
                width: 62,
                height: 62,
                borderRadius: radius.full,
                backgroundColor: ready ? colors.primary : colors.gray400,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="scan-line" size={26} color="#FFFFFF" />}
            </View>
          </Pressable>
        </View>
        <View style={{ width: SIDE_SLOT, alignItems: 'center' }}>
          {hasTorch ? (
            <Pressable
              onPress={onToggleTorch}
              accessibilityRole="button"
              accessibilityLabel={torch ? 'Turn off the torch' : 'Turn on the torch'}
              style={{ width: 36, height: 36 }}
            >
              {torch ? (
                // Inverted when on, so "lit" reads at a glance rather than
                // needing the icon to be decoded. Solid rather than glass: a
                // translucent surface samples the scene behind it, so "on"
                // would look different depending on where the camera points.
                <View style={[ROUND_FILL, { backgroundColor: '#FFFFFF' }]}>
                  <Icon name="zap" size={18} color={colors.primary} />
                </View>
              ) : (
                <ChromeGlass interactive scrim={TORCH_SCRIM} style={ROUND_FILL}>
                  <Icon name="zap-off" size={18} color="#FFFFFF" />
                </ChromeGlass>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
