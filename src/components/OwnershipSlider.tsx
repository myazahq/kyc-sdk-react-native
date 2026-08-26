import React, { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

import { useTheme } from './runtime';

// ─── A 0–100 slider for the ownership field ──────────────────────────────────
//
// The fast coarse gesture beside the exact box: dragging writes whole numbers
// into the same field, and a register stake like 48.42 is still typed (no
// thumb lands on it). Dependency-free — a track, a fill and a thumb under one
// PanResponder — because a native slider module is a heavy import for one
// field. Mirrors the web SDK's range input under the same box.

const THUMB = 22;
const TRACK = 5;

export function OwnershipSlider({
  value,
  onChange,
}: {
  /** The current stake 0–100; an undeclared one rests the thumb at 0. */
  value: number;
  onChange: (next: number) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setFromX = (x: number): void => {
    const usable = widthRef.current - THUMB;
    if (usable <= 0) return;
    const ratio = (x - THUMB / 2) / usable;
    const next = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
    onChangeRef.current(next);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const clamped = Math.min(100, Math.max(0, value));
  const left = width > 0 ? (clamped / 100) * (width - THUMB) : 0;

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      accessibilityRole="adjustable"
      accessibilityLabel="Ownership percentage"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      // Tall hit area; the visible track stays thin.
      style={{ height: 32, justifyContent: 'center' }}
    >
      <View
        style={{
          height: TRACK,
          borderRadius: TRACK / 2,
          backgroundColor: colors.border,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          width: left + THUMB / 2,
          height: TRACK,
          borderRadius: TRACK / 2,
          backgroundColor: colors.primary,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: colors.primary,
          borderWidth: 3,
          borderColor: colors.background,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </View>
  );
}
