import { Platform, StatusBar } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { useVerificationConfig } from './runtime';
import { useSandboxBannerVisible } from './SandboxBanner';

// ---------------------------------------------------------------------------
// Where a step that has the WHOLE sheet may start and stop drawing.
//
// A step that takes the sheet (the full-screen liveness camera) has no header
// above it and no footer below it, so it has to keep clear of the status bar
// and the home indicator itself. These are the sheet's own numbers
// (VerificationSheet computes the same ones for its header and footer):
//
//   • Android: an edge-to-edge modal, so the status bar's inset applies.
//   • iOS pageSheet: already below the status bar, so nothing to clear at the
//     top. At the BOTTOM it runs to the edge of the screen, under the home
//     indicator, so the phone's own bottom inset applies: without it the line
//     on the bottom edge of the camera sat on the indicator.
//   • iOS full screen (disableClose): 56 covers the status bar and the notch.
//
// The sandbox banner sits above the step and absorbs the top inset when it is
// showing, so the step then starts flush under it.
// ---------------------------------------------------------------------------

export function useSheetInsets(): { top: number; bottom: number } {
  const config = useVerificationConfig();
  const bannerVisible = useSandboxBannerVisible();
  const sa = initialWindowMetrics?.insets;
  const iosFullScreen = Platform.OS === 'ios' && config.disableClose === true;
  const top =
    Platform.OS === 'android'
      ? sa?.top || StatusBar.currentHeight || 28
      : iosFullScreen
        ? 56
        : 0;
  const bottom = Platform.OS === 'android' ? (sa?.bottom ?? 0) : iosFullScreen ? 34 : (sa?.bottom ?? 0);
  return { top: bannerVisible ? 0 : top, bottom };
}

/** The height of the back and close buttons the sheet draws over such a step,
 *  with the gap above and below them. The step keeps its words clear of it. */
export const IMMERSIVE_CONTROLS_BAND = 8 + 44 + 4;
