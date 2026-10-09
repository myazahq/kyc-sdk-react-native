import type { HybridView, HybridViewMethods, HybridViewProps } from 'react-native-nitro-modules';

// ---------------------------------------------------------------------------
// Nitro spec for a view that keeps a finger's drag for React Native.
//
// On iOS a drag that starts on a JS-handled control inside the flow's sheet is
// also seen by two native recognisers the JS responder system cannot refuse:
// the scroll view's pan, and the pan that drags a page sheet down. Signing
// with a finger scrolled the page and pulled the sheet down, which the flow
// reads as "go back".
//
// Laid over such a control, this view answers "no" to any pan recogniser that
// asks whether it may begin for a touch that started on it, so the drag stays
// with JS. It draws nothing and takes no touches for itself.
//
// iOS only. Android honours the JS responder's claim already.
// ---------------------------------------------------------------------------

export interface MyazaTouchGuardProps extends HybridViewProps {
  /** Off, the view lets every gesture through. */
  guarding: boolean;
}

export interface MyazaTouchGuardMethods extends HybridViewMethods {}

export type MyazaTouchGuard = HybridView<MyazaTouchGuardProps, MyazaTouchGuardMethods, { ios: 'swift' }>;
