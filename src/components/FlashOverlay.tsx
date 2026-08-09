import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useStore } from 'zustand';
import Svg, { Path, Rect } from 'react-native-svg';

import { holePath, type FlashHole } from './flashHoleGeometry';
import { useKycStore } from './runtime';
import { MyazaText } from './Typography';
import { spacing } from '../config/theme';

export type { FlashHole } from './flashHoleGeometry';

// ---------------------------------------------------------------------------
// The flash overlay: a full-screen colour with a hole over the camera preview.
//
// The screen IS the light source. How much of it is lit is not cosmetic — it
// decides how much light reaches the face, and therefore whether the reflection
// is measurable at all. An overlay confined to the step's own body only lit the
// inset sheet, leaving the rest of the display dark; that is a fraction of the
// available light and it made flashes read as inconclusive.
//
// So it paints at the SHEET ROOT — over the header, the body and the footer,
// but inside the same tree as the preview.
//
// Not in a modal of its own, which is the obvious way to reach the physical
// screen edges and does not work: iOS scales a presenting sheet back when a
// modal appears over it, and RN's `measureInWindow` reports Yoga LAYOUT
// coordinates, which never reflect that UIKit transform. The cutout came back
// as exactly the preview's layout size (300pt) while the preview was rendering
// at ~232pt — off by the transform, and no re-measuring can converge on a value
// the measurement API cannot observe.
//
// Painting in the same tree makes the hole and the preview scale TOGETHER, so
// they agree by construction rather than by measurement. The cost is the strip
// above an iOS page sheet, which stays unlit — a bounded, predictable loss,
// where a misaligned hole is an unbounded one.
//
// A hole is not required for correctness: light lost through it is constant
// across the neutral and lit windows, so it cancels in the comparison either
// way. If measurement fails the overlay paints solid — the user loses sight of
// their own framing for about a second, which is worth far less than failing
// the check outright. Flutter takes the same fallback.
// ---------------------------------------------------------------------------

/**
 * Rendered once at the sheet root.
 *
 * It subscribes to the paint slot ITSELF rather than taking props, so a colour
 * change re-renders this leaf alone. Threading the colour down through the sheet
 * would re-render the step on every flash — and the camera with it, mid-capture.
 */
export function FlashOverlay(): React.ReactElement | null {
  const store = useKycStore();
  const paint = useStore(store, (s) => s.flashPaint);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  if (!paint) return null;
  const { color, hole } = paint;

  return (
    <View
      testID="kyc.liveness.flash"
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (size?.width !== width || size?.height !== height) setSize({ width, height });
      }}
      // zIndex covers iOS sibling stacking; elevation covers Android, where a
      // sibling WITH elevation (the glass header) otherwise paints above any
      // absolute overlay that has none.
      style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }]}
    >
      {color && size ? (
        <Panels color={color} hole={hole} width={size.width} height={size.height} />
      ) : null}
    </View>
  );
}

/**
 * The colour, with a CIRCULAR bite taken out of it.
 *
 * Four rectangles around the preview were cheaper, but they can only ever
 * describe a rectangle — against a circular preview that leaves the corners
 * painted over the user's face, which is precisely the part they need to see to
 * stay framed.
 *
 * A single even-odd path is the actual shape: the screen rectangle and the
 * preview circle as two subpaths, so the circle is subtracted rather than drawn.
 * One node, no mask, no per-frame compositing.
 */
function Panels({
  color,
  hole,
  width,
  height,
}: {
  color: string;
  hole: FlashHole | null;
  width: number;
  height: number;
}): React.ReactElement {
  return (
    <>
      <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        {hole ? (
          <Path
            // Screen rect, then the circle as two arcs. `evenodd` is what makes
            // the second subpath a hole instead of a second filled shape.
            d={holePath(width, height, hole)}
            fill={color}
            fillRule="evenodd"
          />
        ) : (
          // Measurement failed — paint solid. The face is still lit, which is
          // what the check needs; only the framing preview is lost.
          <Rect x={0} y={0} width={width} height={height} fill={color} />
        )}
      </Svg>

      <HoldStill hole={hole} width={width} height={height} />
    </>
  );
}

/**
 * The one instruction shown during a flash.
 *
 * Anchored near the BOTTOM of the sheet, deliberately not hugging the cutout:
 * text directly above and below the preview crowded the only part of the screen
 * the user is meant to be looking at, and read as two competing messages.
 *
 * Clamped to sit below the cutout as well, so on a short screen — where the
 * preview sits low — it moves down rather than landing on the face.
 */
function HoldStill({
  hole,
  width,
  height,
}: {
  hole: FlashHole | null;
  width: number;
  height: number;
}): React.ReactElement {
  const belowHole = hole ? hole.y + hole.size + spacing.xl : 0;
  const top = Math.min(Math.max(belowHole, height * 0.78), height - spacing.xl * 2);
  return (
    <View style={{ position: 'absolute', top, left: 0, width, alignItems: 'center' }}>
      {/* Dark text: every palette colour is high-luminance, so white would be
          unreadable on cyan and green. */}
      <MyazaText variant="heading3" color="rgba(0,0,0,0.8)" style={{ textAlign: 'center' }}>
        Hold still
      </MyazaText>
    </View>
  );
}
