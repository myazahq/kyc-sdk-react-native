import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

// ---------------------------------------------------------------------------
// Document ghost.
//
// A faint outline of the document's LAYOUT inside the capture guide, shown for
// a few seconds when the camera opens: where the portrait sits, where the
// printed details run, and — on a passport — the machine-readable band across
// the bottom.
//
// The guide rectangle says WHERE to put the document. It does not say which way
// round, and the commonest passport mistake is framing the page with the MRZ
// cropped off the bottom edge — which auto-capture then refuses, because that
// band is the chip's key and the proof the page is a passport.
//
// Placeholder BARS and BLOCKS, never literal drawings: nothing here is meant to
// be read, only recognised as a shape. A sketched face would be a worse thing
// to show a user than nothing at all.
//
// Ported from the Flutter SDK's DocumentGhost — geometry included, so the two
// cannot drift.
// ---------------------------------------------------------------------------

/** How long the ghost stays before fading. Long enough to register while the
 *  user is still lifting the document into frame; short enough to be gone
 *  before it can obscure the document itself. */
const GHOST_MS = 5000;

const LINE = 'rgba(255,255,255,0.30)';
const FILL = 'rgba(255,255,255,0.12)';
const BAND = 'rgba(255,255,255,0.35)';

export function DocumentGhost({
  x,
  y,
  width,
  height,
  showMrzBand,
  documentFound,
}: {
  /** The guide rect, in the same coordinates the overlay uses. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Passport data pages carry a machine-readable band. */
  showMrzBand: boolean;
  /** Hides it early: once a document is framed the guidance has done its job
   *  and would only sit on top of the thing being captured. */
  documentFound: boolean;
}): React.ReactElement | null {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, GHOST_MS);
    return () => clearTimeout(t);
  }, [opacity]);

  useEffect(() => {
    if (!documentFound) return;
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  }, [documentFound, opacity]);

  if (width <= 0 || height <= 0) return null;

  // Inset so the layout sits inside the document's edge, not on the guide.
  const pad = width * 0.07;
  const pl = x + pad;
  const pt = y + pad;
  const pw = width - pad * 2;
  const ph = height - pad * 2;

  const photoW = pw * 0.24;
  const photoH = ph * (showMrzBand ? 0.46 : 0.58);

  // Alternating lengths so it reads as printed fields rather than a barcode.
  const barLeft = pl + photoW + pw * 0.06;
  const barMax = pl + pw - barLeft;
  const widths = [1.0, 0.62, 0.85, 0.5];
  const barH = Math.min(7, Math.max(3, photoH * 0.1));

  const bandH = Math.min(8, Math.max(3, ph * 0.055));
  const bandTop = pt + ph - bandH * 3.2;

  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity }}>
      <Svg width="100%" height="100%">
        {/* Portrait block — a block, not a face. The proportion identifies it. */}
        <Rect x={pl} y={pt} width={photoW} height={photoH} rx={4} fill={FILL} />
        <Rect
          x={pl}
          y={pt}
          width={photoW}
          height={photoH}
          rx={4}
          fill="none"
          stroke={LINE}
          strokeWidth={1.5}
        />

        {widths.map((w, i) => {
          const by = pt + photoH * (0.08 + i * 0.26);
          if (by + barH > pt + photoH) return null;
          return (
            <Rect
              key={i}
              x={barLeft}
              y={by}
              width={barMax * w}
              height={barH}
              rx={barH / 2}
              fill={FILL}
            />
          );
        })}

        {/* The reason the ghost exists: it shows the band belongs INSIDE the
            frame, which is the edge users most often crop away. */}
        {showMrzBand
          ? [0, 1].map((i) => (
              <Rect
                key={`b${i}`}
                x={pl}
                y={bandTop + i * bandH * 1.9}
                width={pw * (i === 0 ? 1 : 0.93)}
                height={bandH}
                rx={bandH / 2}
                fill={BAND}
              />
            ))
          : null}
      </Svg>
    </Animated.View>
  );
}
