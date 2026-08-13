import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import { GlassSurface } from './GlassSurface';

// ---------------------------------------------------------------------------
// ChromeGlass — the surface behind controls that float over the LIVE CAMERA.
//
// This is the strongest case for Liquid Glass in the SDK: the chrome floats
// above content, it is interactive, and the background is a moving scene rather
// than a flat tint, which is exactly the condition the material was designed
// for (it is what the iOS Camera app does).
//
// Two properties are load-bearing, and both exist to protect the white glyphs:
//
//   • `colorScheme: 'dark'` — forced, NOT the app theme. These icons are white
//     against a camera feed, not against the app's background, so a light app
//     theme would put pale glass under white icons.
//
//   • `tintColor` — a dark bias over the glass. Plain glass is translucent, so
//     a white passport page filling the frame would wash a white glyph out.
//     The flat scrim this replaces guaranteed contrast; the tint is what buys
//     that guarantee back while keeping the material's depth and adaptivity.
//
// Off iOS 26 it renders the ORIGINAL flat scrim, so Android and older iOS are
// pixel-identical to before. Glass stays purely additive.
// ---------------------------------------------------------------------------

/** The flat scrim used before glass, and still the fallback everywhere else. */
export const CHROME_SCRIM = 'rgba(0,0,0,0.55)';

/** Dark bias laid over the glass so white glyphs survive a bright scene. */
const CHROME_TINT = 'rgba(0,0,0,0.28)';

export interface ChromeGlassProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Whether the glass reacts to touch. True for buttons, false for pills. */
  interactive?: boolean;
  /**
   * Overrides the scrim on the fallback path. Pass the value the call site used
   * before, so non-glass devices keep their exact previous appearance.
   */
  scrim?: string;
}

export function ChromeGlass({
  children,
  style,
  interactive = false,
  scrim = CHROME_SCRIM,
}: ChromeGlassProps): React.ReactElement {
  return (
    <GlassSurface
      glassStyle="regular"
      colorScheme="dark"
      tintColor={CHROME_TINT}
      interactive={interactive}
      fallbackColor={scrim}
      style={style}
    >
      {children}
    </GlassSurface>
  );
}
