import React, { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from './runtime';
import { Icon } from './Icon';
import { MyazaText } from './Typography';
import { DocumentReviewThumb, type ReviewSide } from './DocumentReviewSide';
import { DocumentReviewZoom } from './DocumentReviewZoom';
import { radius, spacing } from '../config/theme';

// ─── Document review ──────────────────────────────────────────────────────────
//
// What the user sees once their document is captured.
//
// The two-sided version used to stack the sides full-width with a retake button
// under each, which on a phone pushed the back image AND the Continue button
// below the fold — people reported not realising there was anything left to do.
// A review screen whose primary action you have to discover by scrolling is a
// dead end, so the layout is:
//
//   • both sides SIDE BY SIDE at every size, so "both captured" reads at a
//     glance instead of by scrolling;
//   • retake as a labelled button under each thumbnail, which removes the two
//     full-width buttons that cost the most vertical space;
//   • the action bar at the BOTTOM of the viewport, so Continue is visible
//     however tall the content gets;
//   • tap a thumbnail to enlarge it — side by side means smaller, and checking
//     the capture is legible is the entire point of this screen.
//
// Mirrors the web SDK's DocumentReview and Flutter's document_review.dart so
// all three behave the same.
//
// Unlike Flutter, the step here sits inside the sheet's own ScrollView (which
// already carries the bottom safe-area inset), so the footer is pushed down by
// a flexible spacer rather than pinned with a hand-computed inset.

export function DocumentReview({
  frontUri,
  backUri,
  aspect,
  isBusy,
  busyOverlay,
  footer,
  onRetakeFront,
  onRetakeBack,
}: {
  frontUri: string;
  backUri?: string | null;
  /** Document aspect, so a half-width thumbnail still shows the whole card. */
  aspect: number;
  /** Uploading — dims the thumbnails and disables retake. */
  isBusy: boolean;
  /** Painted over each thumbnail while busy (the upload loader). */
  busyOverlay?: React.ReactNode;
  /** Errors, retry notices and the Continue button — below the images. */
  footer: React.ReactNode;
  onRetakeFront?: () => void;
  onRetakeBack?: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const [zoomed, setZoomed] = useState<ReviewSide | null>(null);

  const sides: ReviewSide[] = [
    { id: 'front', label: 'Front', uri: frontUri, onRetake: onRetakeFront },
    ...(backUri ? [{ id: 'back' as const, label: 'Back', uri: backUri, onRetake: onRetakeBack }] : []),
  ];
  const twoSided = sides.length > 1;

  return (
    <View style={{ flex: 1 }}>
      {/* Says the capture is COMPLETE — the thing users were scrolling to find
          out. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: radius.full,
            backgroundColor: `${colors.success}26`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="check" size={13} color={colors.success} />
        </View>
        <View style={{ width: spacing.xs }} />
        <MyazaText variant="bodySmall" style={{ fontWeight: '600' }}>
          {twoSided ? 'Both sides captured' : 'Photo captured'}
        </MyazaText>
      </View>

      <View style={{ height: spacing.md }} />

      {/* Top-aligned: the images are what the user checks first, so they sit
          where the eye lands rather than floating in the middle of the screen. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {sides.map((side, i) => (
          <React.Fragment key={side.id}>
            {i > 0 ? <View style={{ width: spacing.sm }} /> : null}
            <View style={{ flex: 1 }}>
              <DocumentReviewThumb
                side={side}
                aspect={aspect}
                isBusy={isBusy}
                // Gated on isBusy HERE, not on the prop's existence. The tile
                // rendered it whenever it was provided — and the caller always
                // provides it — so the loader sat over the preview forever and
                // the screen read as permanently stuck.
                busyOverlay={isBusy ? busyOverlay : null}
                onZoom={() => setZoomed(side)}
              />
            </View>
          </React.Fragment>
        ))}
      </View>

      <View style={{ height: spacing.xs }} />
      <MyazaText variant="bodySmall" color={colors.textMuted} style={{ textAlign: 'center' }}>
        Tap a photo to see it larger.
      </MyazaText>

      {/* Pushes the action bar to the bottom of the viewport so Continue can
          never end up below the fold. */}
      <View style={{ flex: 1, minHeight: spacing.md }} />

      <View testID="kyc.review.footer">{footer}</View>

      {zoomed ? (
        <DocumentReviewZoom
          side={zoomed}
          isBusy={isBusy}
          onClose={() => setZoomed(null)}
          onRetake={() => {
            const retake = zoomed.onRetake;
            setZoomed(null);
            retake?.();
          }}
        />
      ) : null}
    </View>
  );
}
