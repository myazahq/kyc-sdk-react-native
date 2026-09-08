import React from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { LineSkeleton } from '../../components/LineSkeleton';
import { ADDRESS_LINE_PENDING, ADDRESS_LINE_UNAVAILABLE } from '../../lib/address-line';

// The address band under the review card's map (200-line split from
// AddressReviewStep): the success card's header-band language, so the
// confirmation and the "check active" card read as one design. Web's exact
// geometry: the band's row clears the thumbnails with pr-32 (128) and
// min-h-[4.25rem] (68). Flutter draws the same band. EXACTLY 128: the 12 of
// breathing room once added here starved the "Pinned address" pill on a
// 360dp phone (the S24, 2026-09-08), so the label wrapped inside its pill
// here and overflowed on Flutter.

const BAND_CLEARANCE = 128;
const BAND_MIN_HEIGHT = 68;

export function ReviewAddressBand({
  isBusiness,
  hasAddress,
  line,
  labelling,
  directions,
  clearsHero,
  onEdit,
}: {
  isBusiness: boolean;
  hasAddress: boolean;
  /** The composed line; '' while the pin has no readable address yet. */
  line: string;
  labelling: boolean;
  directions: string | null;
  /** Something hangs over the map's edge: the band clears it. */
  clearsHero: boolean;
  onEdit: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
        <View
          style={{
            backgroundColor: `${colors.primary}0F`,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            paddingRight: clearsHero ? BAND_CLEARANCE : spacing.md,
            minHeight: clearsHero ? BAND_MIN_HEIGHT : undefined,
            borderBottomLeftRadius: radius.md - 1,
            borderBottomRightRadius: radius.md - 1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  gap: spacing.sm,
                  maxWidth: '100%',
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 4,
                  borderRadius: radius.full,
                  backgroundColor: `${colors.primary}1A`,
                }}
              >
                <Icon name="map-pin" size={12} color={colors.primary} />
                {/* One line, shrinking with an ellipsis when starved (a large
                    text scale), as Flutter's pill does. */}
                <MyazaText
                  variant="bodySmall"
                  color={colors.primary}
                  numberOfLines={1}
                  style={{ flexShrink: 1, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' }}
                >
                  {isBusiness ? 'Pinned premises' : 'Pinned address'}
                </MyazaText>
              </View>

              {/* Never coordinates: an unread pin shows a skeleton line while
                  its address is still coming. Web's `text-base font-semibold`:
                  the body face, not a heading. */}
              {hasAddress && !line && labelling ? (
                <LineSkeleton label={ADDRESS_LINE_PENDING} variant="body" barHeight={12} width="70%" style={{ marginTop: spacing.xs }} />
              ) : (
                <MyazaText variant="body" style={{ marginTop: spacing.xs, fontWeight: '600' }}>
                  {!hasAddress ? 'No pin placed' : line || ADDRESS_LINE_UNAVAILABLE}
                </MyazaText>
              )}

              {directions ? (
                <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 2 }}>
                  {`“${directions}”`}
                </MyazaText>
              ) : null}
            </View>

            {/* A plain link (web `text-sm text-primary`); the band's right
                padding keeps it clear of the entrance hanging over it. */}
            <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Edit" hitSlop={8}>
              <MyazaText variant="bodyMedium" color={colors.primary}>
                Edit
              </MyazaText>
            </Pressable>
          </View>
        </View>
  );
}
