import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { useTheme } from './runtime';
import { Icon } from './Icon';
import { MyazaText } from './Typography';
import { radius, spacing } from '../config/theme';

// ─── One captured side, and its enlarged view ─────────────────────────────────
//
// Split from DocumentReview.tsx so each file stays readable. Mirrors the
// Flutter SDK's document_review_side.dart.
//
// The photo carries only LABELS — which side it is, and that tapping enlarges
// it. The actions are named buttons underneath. An icon-only control floating
// on an image reads as decoration on a phone, where there is no hover to
// reveal what it does.

export interface ReviewSide {
  /** 'front' | 'back' — also the testID suffix. */
  id: 'front' | 'back';
  label: string;
  uri: string;
  onRetake?: () => void;
}

export function DocumentReviewThumb({
  side,
  aspect,
  isBusy,
  busyOverlay,
  onZoom,
}: {
  side: ReviewSide;
  aspect: number;
  isBusy: boolean;
  busyOverlay?: React.ReactNode;
  onZoom: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View>
      <View
        testID={`kyc.review.${side.id}`}
        style={{ borderRadius: radius.md, overflow: 'hidden' }}
      >
        <Pressable onPress={onZoom} accessibilityRole="imagebutton" accessibilityLabel={`${side.label} photo — tap to enlarge`}>
          {/* The whole card stays visible at half width — a cropped thumbnail
              cannot be checked for legibility, which is the only reason this
              screen exists. */}
          <Image
            source={{ uri: side.uri }}
            style={{ width: '100%', aspectRatio: aspect, backgroundColor: colors.backgroundSecondary }}
            resizeMode="contain"
          />
        </Pressable>
        {/* Inset past the corner CURVE, not just past the edge: at this radius
            a 6px offset puts the badge on the round, where it reads as
            clipped. */}
        <View style={{ position: 'absolute', left: spacing.md, top: spacing.md }}>
          <Chip>
            <MyazaText variant="bodySmall" color="#FFFFFF" style={CHIP_TEXT}>
              {side.label}
            </MyazaText>
          </Chip>
        </View>
        {/* Enlarging is a tap on the image, which nothing announces — so the
            image says so itself. */}
        <View style={{ position: 'absolute', right: spacing.md, bottom: spacing.md }} pointerEvents="none">
          <Chip icon>
            <Icon name="maximize" size={18} color="#FFFFFF" />
          </Chip>
        </View>
        {busyOverlay ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>{busyOverlay}</View>
        ) : null}
      </View>

      {/* Retake as a LABELLED control, not an icon on the photo.
          The web version hides it under the image and reveals it on hover; a
          phone has no hover, so that became a small unlabelled circle people
          did not read as a button. Naming it costs a few pixels and is the
          difference between a discoverable action and a decoration. */}
      <Pressable
        testID={`kyc.review.retake.${side.id}`}
        onPress={isBusy ? undefined : side.onRetake}
        disabled={isBusy}
        accessibilityRole="button"
        accessibilityLabel={`Retake ${side.label.toLowerCase()}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 36, // stays a comfortable tap target
          paddingVertical: 4,
          marginTop: spacing.xs,
          opacity: isBusy ? 0.4 : 1,
        }}>
        <Icon name="refresh" size={14} color={colors.primary} />
        <View style={{ width: 6 }} />
        <MyazaText variant="bodySmall" color={colors.primary} style={{ flexShrink: 1 }}>
          Retake
        </MyazaText>
      </Pressable>
    </View>
  );
}

export const CHIP_TEXT = { fontSize: 11, fontWeight: '600' as const };

/**
 * A small dark label over the photo. Non-interactive by design — the actions on
 * this screen are named buttons, not icons floating on an image.
 */
export function Chip({
  children,
  /** Icon chips are square and need room around the glyph, not text padding. */
  icon = false,
}: {
  children: React.ReactNode;
  icon?: boolean;
}): React.ReactElement {
  return (
    <View
      style={{
        paddingHorizontal: icon ? 8 : 10,
        paddingVertical: icon ? 8 : 5,
        borderRadius: radius.full,
        backgroundColor: 'rgba(0,0,0,0.55)',
      }}
    >
      {children}
    </View>
  );
}
