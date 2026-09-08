import React from 'react';
import { View } from 'react-native';

import { MyazaText } from '../../components/Typography';

// The framing chrome over the Street View panorama: a dimmed surround, a
// white rounded frame and the caption above it. A mirror of the web SDK's
// framer overlay (identical geometry, so hosted, embedded and native
// applicants meet the same instrument) and the Flutter street_view_chrome.
// RN has no box-shadow spread, so the dim mask is four views around the
// frame. pointerEvents="none" throughout: the drag reaches the WebView.

export interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The frame's rectangle inside a viewport: 58% wide (max 320), 56% tall
 *  (max 300), centred horizontally, its centre 44% down. */
export function streetViewFrameRect(viewportWidth: number, viewportHeight: number): FrameRect {
  const width = Math.min(viewportWidth * 0.58, 320);
  const height = Math.min(viewportHeight * 0.56, 300);
  return {
    left: (viewportWidth - width) / 2,
    top: viewportHeight * 0.44 - height / 2,
    width,
    height,
  };
}

const DIM = 'rgba(0, 0, 0, 0.45)';

export function StreetViewChrome({
  viewportWidth,
  viewportHeight,
}: {
  viewportWidth: number;
  viewportHeight: number;
}): React.ReactElement | null {
  if (viewportWidth <= 0 || viewportHeight <= 0) return null;
  const f = streetViewFrameRect(viewportWidth, viewportHeight);
  const right = viewportWidth - f.left - f.width;
  const bottom = viewportHeight - f.top - f.height;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: f.top, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: bottom, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', top: f.top, left: 0, width: f.left, height: f.height, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', top: f.top, right: 0, width: right, height: f.height, backgroundColor: DIM }} />
      <View
        style={{
          position: 'absolute',
          top: f.top,
          left: f.left,
          width: f.width,
          height: f.height,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: 'rgba(255, 255, 255, 0.95)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: f.top - 40,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <View style={{ borderRadius: 999, backgroundColor: 'rgba(0, 0, 0, 0.65)', paddingHorizontal: 12, paddingVertical: 6 }}>
          <MyazaText variant="bodySmall" color="#ffffff" style={{ fontWeight: '600' }}>
            Fit your entrance in the frame
          </MyazaText>
        </View>
      </View>
    </View>
  );
}
