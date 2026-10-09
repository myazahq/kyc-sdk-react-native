import type { HybridView, HybridViewMethods, HybridViewProps } from 'react-native-nitro-modules';

// ---------------------------------------------------------------------------
// Nitro spec for the blur around the face window of the full-screen liveness
// camera.
//
// React Native cannot blur what is behind a view, and no blur library can
// leave a hole in the blur that is not a rounded rectangle, which the face
// window needs. So this SDK draws its own: one native view, laid over the
// camera, that blurs everything behind it EXCEPT a round-ended window.
//
//   iOS      a UIVisualEffectView with a mask (ios/HybridMyazaBackdropBlur).
//   Android  the view drawn just before this one in the same parent is
//            recorded and drawn again, blurred, outside the window
//            (HybridMyazaBackdropBlur.kt). Android 12 and later only, and the
//            camera must be a TextureView (`implementationMode="compatible"`):
//            a SurfaceView is drawn by the system behind the window and cannot
//            be recorded. Older Android draws nothing, and the screen lays a
//            plain tint instead (see components/BackdropBlur).
//
// The window is given in this view's own coordinates, in points.
// ---------------------------------------------------------------------------

export interface MyazaBackdropBlurProps extends HybridViewProps {
  windowX: number;
  windowY: number;
  windowWidth: number;
  windowHeight: number;
  /** The flow's own theme, which may not be the phone's. */
  dark: boolean;
}

export interface MyazaBackdropBlurMethods extends HybridViewMethods {}

export type MyazaBackdropBlur = HybridView<
  MyazaBackdropBlurProps,
  MyazaBackdropBlurMethods,
  { ios: 'swift'; android: 'kotlin' }
>;
