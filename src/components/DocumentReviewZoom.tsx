import React from 'react';
import { Image, Modal, Platform, Pressable, StatusBar, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { radius, spacing } from '../config/theme';
import { Icon } from './Icon';
import { MyazaText } from './Typography';
import { MyazaButton } from './MyazaButton';
import { Chip, CHIP_TEXT, type ReviewSide } from './DocumentReviewSide';

/**
 * Full-bleed view of one side, with retake to hand — checking a capture and
 * deciding to redo it are the same moment.
 *
 * Deliberately opaque and dark. The first version tinted the theme background
 * at 97% opacity, which on the dark theme is very nearly the colour it sits on:
 * tapping a photo appeared to do nothing. An overlay has to announce itself as
 * a new layer, so this one is near-black regardless of theme, with a close
 * control big enough to find.
 */
/** Clearance for the status bar / notch above the zoom's own controls. */
function topInset(): number {
  const sa = initialWindowMetrics?.insets;
  if (Platform.OS === 'android') return sa?.top || StatusBar.currentHeight || 28;
  // iOS presents this modal full-screen under the bar; 44 clears the island on
  // the notched devices and is harmless on the ones without.
  return sa?.top || 44;
}

/**
 * Clearance for the home indicator / nav bar BELOW the zoom's controls.
 *
 * The modal runs edge to edge, so without this the Retake button sits flush
 * against the bottom of the screen — clipped by the indicator and awkward to
 * hit, since that strip belongs to the system gesture.
 */
function bottomInset(): number {
  const sa = initialWindowMetrics?.insets;
  if (Platform.OS === 'android') return sa?.bottom ?? 0;
  return sa?.bottom || 34;
}

export function DocumentReviewZoom({
  side,
  isBusy,
  onClose,
  onRetake,
}: {
  side: ReviewSide;
  isBusy: boolean;
  onClose: () => void;
  onRetake: () => void;
}): React.ReactElement {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* The modal is statusBarTranslucent, so its content starts at y=0 —
          under the notch / Dynamic Island. Without the inset the close button
          renders BEHIND the island and the only way out of a full-screen image
          is invisible. Same static safe-area snapshot the sheet uses. */}
      <View
        testID="kyc.review.zoom"
        style={{
          flex: 1,
          backgroundColor: '#0A0A12F2',
          padding: spacing.sm,
          paddingTop: spacing.sm + topInset(),
          paddingBottom: spacing.sm + bottomInset(),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Chip>
            <MyazaText variant="bodySmall" color="#FFFFFF" style={[CHIP_TEXT, { flexShrink: 1 }]}>
              {side.label}
            </MyazaText>
          </Chip>
          <View style={{ flex: 1 }} />
          {/* A filled circle, not a bare glyph on a dark field: the way out of
              a full-screen view has to be obvious. */}
          <Pressable
            testID="kyc.review.zoom.close"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.full,
              backgroundColor: 'rgba(255,255,255,0.14)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={{ height: spacing.sm }} />
        {/* Tapping the image again closes it — the same gesture that opened it,
            which is what people try first. */}
        <Pressable onPress={onClose} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel="Close enlarged photo">
          <Image
            source={{ uri: side.uri }}
            style={{ flex: 1, width: '100%', borderRadius: radius.md }}
            resizeMode="contain"
          />
        </Pressable>

        <View style={{ height: spacing.sm }} />
        <MyazaButton
          label={`Retake ${side.label.toLowerCase()}`}
          leadingIcon="refresh"
          variant="outline"
          disabled={isBusy}
          onPress={onRetake}
        />
      </View>
    </Modal>
  );
}
