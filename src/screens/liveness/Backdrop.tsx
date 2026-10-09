import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BackdropBlur, backdropBlurSupported } from '../../components/BackdropBlur';
import { useTheme } from '../../components/runtime';
import { useReduceMotion } from '../../components/StaggerIn';
import {
  LIVENESS_DIM_ROOM_TINT,
  LIVENESS_FLAT_TINT,
  LIVENESS_TINT,
  surroundPath,
  type Rect,
  type Size,
} from '../../lib/livenessCutout';
import { StyleAbsFill } from './constants';

// ---------------------------------------------------------------------------
// What fills the full-screen liveness camera: the camera itself, edge to edge,
// sharp inside the face window and blurred everywhere around it, under a tint
// of the flow's background colour.
//
// Three layers, bottom to top:
//
//   the camera        full screen, cover-fit
//   the blur          the SDK's native view, with the window left out of it
//   the tint          the background colour, painted through the same shape
//
// On a phone that cannot blur (Android before 12) the blur is not mounted and
// the tint is heavier, which is the Flutter SDK's own fallback.
// ---------------------------------------------------------------------------

/** Where the camera on this screen has to be a TextureView (Android, when it
 *  is being blurred). Elsewhere the default surface is the faster one. */
export const backdropNeedsTexture = backdropBlurSupported;

function Tint({ frame, window, opacity }: { frame: Size; window: Rect; opacity: number }): React.ReactElement {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const shown = useRef(new Animated.Value(opacity)).current;
  useEffect(() => {
    Animated.timing(shown, {
      toValue: opacity,
      duration: reduceMotion ? 0 : 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [opacity, shown, reduceMotion]);
  return (
    <Animated.View pointerEvents="none" style={[StyleAbsFill, { opacity: shown }]}>
      <Svg width={frame.width} height={frame.height}>
        <Path d={surroundPath(frame, window)} fill={colors.background} fillRule="evenodd" />
      </Svg>
    </Animated.View>
  );
}

export function CameraBackdrop({
  camera,
  frame,
  window,
  dimRoom,
}: {
  /** The live preview, filling whatever box it is given. */
  camera: React.ReactNode;
  frame: Size;
  /** Null until the frame has been measured. */
  window: Rect | null;
  /** The room has read as dark: more of the screen goes to the background. */
  dimRoom: boolean;
}): React.ReactElement {
  const { mode } = useTheme();
  const tint = dimRoom
    ? LIVENESS_DIM_ROOM_TINT
    : backdropBlurSupported
      ? LIVENESS_TINT
      : LIVENESS_FLAT_TINT;
  return (
    <View pointerEvents="none" style={StyleAbsFill} collapsable={false}>
      {/* The blur's two rules (components/BackdropBlur): this view comes just
          before it, and holds one child that is never swapped. The camera
          comes and goes INSIDE that child. */}
      <View style={StyleAbsFill} collapsable={false}>
        <View style={StyleAbsFill} collapsable={false}>
          {camera}
        </View>
      </View>
      {backdropBlurSupported && window ? (
        <BackdropBlur style={StyleAbsFill} window={window} dark={mode === 'dark'} />
      ) : null}
      {window ? <Tint frame={frame} window={window} opacity={tint} /> : null}
    </View>
  );
}

/** Behind the review: the selfie itself, blurred, under the same tint. A
 *  still picture needs no native view; the platform's image blur does it. */
export function PhotoBackdrop({ uri }: { uri: string }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={[StyleAbsFill, { backgroundColor: colors.background }]}>
      <Image
        source={{ uri }}
        blurRadius={24}
        resizeMode="cover"
        style={[StyleAbsFill, { width: '100%', height: '100%' }]}
      />
      <View style={[StyleAbsFill, { backgroundColor: colors.background, opacity: LIVENESS_TINT }]} />
    </View>
  );
}
