import React from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { getHostComponent } from 'react-native-nitro-modules';

import type {
  MyazaBackdropBlurMethods,
  MyazaBackdropBlurProps,
} from '../specs/MyazaBackdropBlur.nitro';
import type { Rect } from '../lib/livenessCutout';

// ---------------------------------------------------------------------------
// The SDK's own blur: everything behind this view, blurred live, except a
// round-ended window (see specs/MyazaBackdropBlur.nitro.ts for how each
// platform does it).
//
// THREE RULES for whoever mounts it on Android:
//
//   1. It blurs the view mounted JUST BEFORE it in the same parent. That view
//      must really exist natively (`collapsable={false}`), and so must the one
//      child it holds, which must never be swapped for another: the blur keeps
//      hold of that child, and follows whatever is drawn inside it.
//   2. The window it leaves sharp is read from a marker view this component
//      mounts beside it, so both must share one parent.
//   3. A camera behind it must be a TextureView
//      (`implementationMode="compatible"`).
//
// screens/liveness/Backdrop is the one place that does this.
// ---------------------------------------------------------------------------

/**
 * Whether this phone can blur live content. Every iPhone can; Android can
 * from version 12. Where it cannot, mount nothing and lay a plain tint.
 */
export const backdropBlurSupported: boolean =
  Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 31);

/** Kept in step with BackdropBlurView.kt's MARKER_ID. */
const BLUR_WINDOW_MARKER = 'myaza-blur-window';

const NativeBackdropBlur = getHostComponent<MyazaBackdropBlurProps, MyazaBackdropBlurMethods>(
  'MyazaBackdropBlur',
  () => require('../../nitrogen/generated/shared/json/MyazaBackdropBlurConfig.json'),
);

export function BackdropBlur({
  window,
  dark,
  style,
}: {
  /** The part left sharp, in this view's own coordinates. */
  window: Rect;
  /** The flow's theme, which is not always the phone's. */
  dark: boolean;
  style?: ViewStyle;
}): React.ReactElement {
  return (
    <>
      <NativeBackdropBlur
        pointerEvents="none"
        style={style}
        windowX={window.x}
        windowY={window.y}
        windowWidth={window.width}
        windowHeight={window.height}
        dark={dark}
      />
      {/* Android finds the window from this view's bounds, not the props
          above, which reach its native side as garbage. It must be a sibling
          of the blur and really exist natively. */}
      {Platform.OS === 'android' ? (
        <View
          nativeID={BLUR_WINDOW_MARKER}
          collapsable={false}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: window.x,
            top: window.y,
            width: window.width,
            height: window.height,
          }}
        />
      ) : null}
    </>
  );
}
