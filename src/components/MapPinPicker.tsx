import React, { useEffect, useRef, useState } from 'react';
import { Image, PanResponder, View } from 'react-native';

import { radius } from '../config/theme';
import { useTheme } from './runtime';
import { MapPinMarker } from './MapPinMarker';
import { MapAttribution, MapZoomControls } from './MapChrome';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  panCenter,
  visibleTiles,
  type LatLng,
} from '../lib/map-tiles';

interface MapPinPickerProps {
  /** The confirmed pin, when one exists — the map centres on it. */
  value: LatLng | null;
  /** Fired when the user settles the map (drag end / zoom / recentre). */
  onChange: (pin: LatLng) => void;
  defaultCenter: LatLng;
  defaultZoom: number;
  /** Taller on the pin step, where there has to be room to actually find the
   *  building; short on the review step's read-only summary. */
  height?: number;
  /**
   * A read-only summary map: no gestures, no zoom controls, no onChange. The
   * review step draws the pin as a picture of the decision, and a map that can
   * be dragged there invites an edit the step is not offering.
   */
  interactive?: boolean;
  /** Corner rounding — squared off when the map is clipped by a card. */
  cornerRadius?: number;
  /** Zoom when the map has a pin. The pin step goes closer than the default so
   *  "is the pin on YOUR building?" is answerable without pinching first. */
  pinZoom?: number;
}

const MAP_HEIGHT = 256;

/**
 * A dependency-free OSM slippy map with a FIXED CENTRE PIN — the user moves
 * the map under the pin (the pattern address pickers use on phones), so the
 * pin is always exactly the centre and there is no marker to fumble. Maths in
 * lib/map-tiles.ts; this is only the gesture shell. Mirrors the web SDK's
 * MapPinPicker: tiles for the committed centre, a live translate during the
 * drag, and a commit (+ onChange) on release.
 */
export function MapPinPicker({
  value,
  onChange,
  defaultCenter,
  defaultZoom,
  height = MAP_HEIGHT,
  interactive = true,
  cornerRadius,
  pinZoom = 17,
}: MapPinPickerProps) {
  const { colors } = useTheme();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [center, setCenter] = useState<LatLng>(value ?? defaultCenter);
  const [zoom, setZoom] = useState(value ? pinZoom : defaultZoom);
  // Live drag offset — applied as a transform so panning stays smooth; the
  // centre (and tile set) commits on release.
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);

  // The responder callbacks close over state, so they read it via a ref — a
  // PanResponder is created once and would otherwise pan against the centre
  // and zoom from the first render forever.
  const live = useRef({ center, zoom, onChange });
  live.current = { center, zoom, onChange };

  // An external recentre (a search pick, or Use my location) moves the map AND
  // zooms in: "is the pin on your building?" cannot be answered at country
  // zoom, and asking someone to pinch first is asking them to do our work.
  // SELF-caused moves round-trip through the same prop (drag commits via
  // onChange → store → new `value`), so a genuinely-external move is one that
  // differs from the centre the map is already showing — without that check,
  // an applicant who zoomed out to find their area was yanked back to pin
  // zoom on every drag. Flutter's picker documents the same hazard.
  useEffect(() => {
    if (!value) return;
    const c = live.current.center;
    if (Math.abs(c.lat - value.lat) < 1e-9 && Math.abs(c.lng - value.lng) < 1e-9) return;
    setCenter(value);
    setZoom((z) => Math.max(z, pinZoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderMove: (_e, g) => setDrag({ dx: g.dx, dy: g.dy }),
      onPanResponderRelease: (_e, g) => {
        setDrag(null);
        if (g.dx === 0 && g.dy === 0) return;
        const { center: c, zoom: z, onChange: fire } = live.current;
        const next = panCenter(c, z, g.dx, g.dy);
        setCenter(next);
        fire(next);
      },
      onPanResponderTerminate: () => setDrag(null),
      // Android: a parent ScrollView (StickyActions) asks to take a vertical
      // drag over once it passes the scroll slop; refuse, and block the native
      // responder, or the map stops dead a few pixels in while the page moves.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    }),
  ).current;

  const zoomBy = (delta: number) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    if (next === zoom) return;
    setZoom(next);
    onChange(center);
  };

  const tiles = size ? visibleTiles(center, zoom, size.w, size.h) : [];

  return (
    <View
      accessibilityLabel={
        interactive ? 'Map. Drag to position the pin on your address.' : 'Map showing your address'
      }
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
      style={{
        height,
        borderRadius: cornerRadius ?? radius.md,
        borderWidth: cornerRadius === 0 ? 0 : 1,
        borderColor: colors.border,
        backgroundColor: colors.backgroundSecondary,
        overflow: 'hidden',
      }}
      {...(interactive ? pan.panHandlers : {})}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: drag ? [{ translateX: drag.dx }, { translateY: drag.dy }] : [],
        }}
      >
        {tiles.map((tile) => (
          <Image
            key={tile.key}
            source={{ uri: tile.url }}
            style={{ position: 'absolute', left: tile.left, top: tile.top, width: 256, height: 256 }}
          />
        ))}
      </View>

      {/* The fixed centre pin — its stem tip on the exact centre, lifted
          with the landing dot beneath it while the map pans. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: height / 2,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <MapPinMarker lifted={drag != null} color={colors.primary} />
      </View>

      {interactive ? <MapZoomControls onZoom={zoomBy} /> : null}
      <MapAttribution />
    </View>
  );
}
