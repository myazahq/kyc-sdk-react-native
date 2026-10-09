import React from 'react';
import { View } from 'react-native';
import { Camera, type CameraDevice, type CameraRef, type CameraViewProps } from 'react-native-vision-camera';

import { registerLivenessCamera } from '../../liveness/cameraSteady';
import { Spinner } from '../../components/Spinner';

// ─── The front camera inside the liveness circle ────────────────────────────
//
// The Camera is mounted inside a plain, BORDERLESS wrapper, and that wrapper is
// the fix for a preview that did not reach the right-hand edge of the circle
// on Android (Galaxy S24, 2026-09-07: a vertical line one border-width in from
// the ring, the clip box's ground showing through).
//
// VisionCamera installs a "hierarchy fitter" on its Android PreviewView: the
// moment CameraX adds the SurfaceView, it re-runs `layout(0, 0, w, h)` on the
// PreviewView so the new child gets measured (React Native never lays native
// children out on its own). That call keeps the SIZE React Native gave the view
// and throws away its POSITION — so a Camera that is the direct child of a
// bordered box snaps from (border, border) back to the box's outer corner. The
// 3:4 preview buffer overflows the circle vertically and hides the shift on
// that axis; horizontally it fits exactly, and the missing border-width is the
// line. iOS has no fitter, which is why only Android showed it.
//
// A wrapper with no border sits at (border, border) itself, laid out by React
// Native, so the fitter's (0, 0) is now the right answer. The wrapper must be
// `collapsable={false}`: a View that carries nothing but layout is FLATTENED on
// Android (it never exists natively, its child is re-parented to the
// grandparent), which put the Camera straight back inside the bordered box
// and reproduced the line on the first attempt. Never mount VisionCamera's
// Camera as the direct child of a view with `borderWidth`.
// Pinned by __tests__/livenessCameraWrapper.test.ts.

interface LivenessCameraProps {
  device: CameraDevice | undefined;
  active: boolean;
  outputs: NonNullable<CameraViewProps['outputs']>;
  /**
   * The Camera's own rounded clip: the diameter of the sheet's circle, or the
   * WIDTH of the full-screen camera's tall window (whose ends are half its
   * width round). Absent fills the box square-cornered.
   */
  circle?: number;
  /**
   * Android: draw the preview in a TextureView, not the default SurfaceView.
   * Needed wherever the preview is blurred (components/BackdropBlur): a
   * SurfaceView sits behind the app's window, where nothing can blur it.
   */
  texture?: boolean;
}

export function LivenessCamera({ device, active, outputs, circle, texture }: LivenessCameraProps): React.ReactElement {
  // The flash holds this camera's exposure and white balance still while it
  // runs (liveness/cameraSteady.ts), so it needs to reach the controller.
  const cameraRef = React.useRef<CameraRef>(null);
  React.useEffect(() => {
    registerLivenessCamera(() => cameraRef.current?.controller);
    return () => registerLivenessCamera(null);
  }, []);
  return (
    <View style={{ flex: 1 }} collapsable={false}>
      {device ? (
        <Camera
          ref={cameraRef}
          // borderRadius repeated on the Camera — iOS does not reliably clip
          // a native child to a rounded parent, so the preview's square
          // corners showed through the circle. Same fix the selfie preview
          // and the header brand bar already carry.
          style={
            circle == null
              ? { flex: 1 }
              : { flex: 1, borderRadius: circle / 2, overflow: 'hidden' }
          }
          device={device}
          isActive={active}
          outputs={outputs}
          implementationMode={texture ? 'compatible' : undefined}
          // Mirror the front-camera preview + capture so it reads like a
          // mirror (matches the web SDK's scaleX(-1) video).
          mirrorMode="on"
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}
