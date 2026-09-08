import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { radius } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MapPinPicker } from '../../components/MapPinPicker';
import { FramedMapPicker } from '../../components/FramedMapPicker';
import { MapPinMarker } from '../../components/MapPinMarker';
import { reviewMapSurface } from '../../lib/review-map-surface';
import type { LatLng } from '../../lib/map-tiles';
import { AddressMapStub } from './AddressMapStub';

// The review card's map (200-line split from AddressReviewStep). The map as a
// PICTURE: a confirmation screen wants a photograph of the place, not a second
// instrument. Which surface draws is lib/review-map-surface.ts, the order the
// web and Flutter cards keep.

// Web's review map is h-48 (192px) at mobile widths; keep the mirror exact.
export const REVIEW_MAP_HEIGHT = 192;

export function ReviewMapPicture({
  pin,
  vendorsStubbed,
  mapsFrameUrl,
  staticMap,
  staticMapFailed,
  onEdit,
  onPictureFailed,
}: {
  pin: LatLng;
  vendorsStubbed: boolean;
  mapsFrameUrl: string | null;
  /** The picture, once fetched with the SDK's bearer (lib/authed-image). */
  staticMap: { uri: string } | null;
  staticMapFailed: boolean;
  onEdit: () => void;
  onPictureFailed: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const surface = reviewMapSurface({
    vendorsStubbed,
    hasStaticMap: staticMap != null,
    staticMapFailed,
    hasFrame: mapsFrameUrl != null,
  });
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel="Edit the pinned location"
      // The picture's own clip: the card above it no longer has one, so the
      // entrance can hang over its bottom edge.
      style={{ borderTopLeftRadius: radius.md - 1, borderTopRightRadius: radius.md - 1, overflow: 'hidden' }}
    >
      {surface === 'stub' ? (
        <AddressMapStub hasPin onLand={() => undefined} defaultCenter={pin} height={REVIEW_MAP_HEIGHT} />
      ) : surface === 'picture' ? (
        <View>
          <Image
            source={staticMap!}
            accessibilityLabel="Map of the pinned location"
            onError={onPictureFailed}
            style={{ width: '100%', height: REVIEW_MAP_HEIGHT, backgroundColor: colors.backgroundSecondary }}
            resizeMode="cover"
          />
          {/* The SDK's own pin, centred on the picture, so the flow shows one
              pin throughout rather than a vendor marker on the last screen. */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
          >
            <MapPinMarker lifted={false} color={colors.primary} />
          </View>
        </View>
      ) : surface === 'pending' ? (
        <View style={{ height: REVIEW_MAP_HEIGHT, backgroundColor: colors.backgroundSecondary }} />
      ) : surface === 'framed' ? (
        // The SAME framed map the pin step draws, so the applicant confirms on
        // the imagery they placed the pin over. Touches are swallowed: the
        // pane above it is the way back to editing.
        <View pointerEvents="none">
          <FramedMapPicker
            frameUrl={mapsFrameUrl!}
            value={pin}
            onChange={() => undefined}
            defaultCenter={pin}
            defaultZoom={16}
            height={REVIEW_MAP_HEIGHT}
            cornerRadius={0}
          />
        </View>
      ) : (
        <MapPinPicker
          value={pin}
          onChange={() => undefined}
          defaultCenter={pin}
          defaultZoom={16}
          pinZoom={16}
          height={REVIEW_MAP_HEIGHT}
          interactive={false}
          cornerRadius={0}
        />
      )}
    </Pressable>
  );
}
