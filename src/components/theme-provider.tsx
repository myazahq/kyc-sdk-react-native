import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { resolveColors, type MyazaColorScheme, type ThemeMode , applyRadiusScale } from '../config/theme';
import type { KYCAppearance } from '../types/config';
import { useMyazaFonts } from './fonts';
import { useBrandFonts } from './brand-font';
import { effectiveThemeMode } from '../lib/bright-screen';

// ---------------------------------------------------------------------------
// Theme context.
//
// Split from the runtime provider because theming and the flow have different
// lifetimes: the trigger button and the workflow-resolution barrier both need
// colours BEFORE there is a resolved config to build a store from. Nesting is
// supported and the inner provider wins, which is how a resolved workflow's
// appearance takes over from the props' once it lands.
// ---------------------------------------------------------------------------

export interface ThemeValue {
  mode: ThemeMode;
  colors: MyazaColorScheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  /**
   * True while a screen has forced the mode (the liveness camera forces
   * light, lib/bright-screen). The toggle does nothing meanwhile and the
   * header shows it disabled.
   */
  forced: boolean;
  /**
   * Force a mode over the person's own choice, or `null` to hand it back.
   * The person's choice is kept underneath, so the way back restores it.
   */
  setForcedMode: (mode: ThemeMode | null) => void;
  /**
   * The colours of the person's OWN mode, whatever is forced. The same as
   * `colors` unless a screen has forced a mode over it.
   */
  ownColors: MyazaColorScheme;
  /** The person's own mode, whatever is forced. */
  ownMode: ThemeMode;
  /** True once Space Grotesk + Karla are loaded (system font until then). */
  fontsLoaded: boolean;
  /** Org font families from `appearance`, when set. Empty object otherwise. */
  brandFonts: { body?: string; heading?: string };
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function MyazaThemeProvider({
  appearance,
  children,
}: {
  appearance?: KYCAppearance;
  children: React.ReactNode;
}): React.ReactElement {
  // `theme: 'system'` follows the DEVICE's colour scheme — live, so an
  // OS-level switch mid-flow repaints — until the in-flow toggle picks a mode
  // explicitly (`override`), which then wins for the rest of the session.
  // 'light'/'dark' (and unset → light) pin the mode exactly as before.
  const systemScheme = useColorScheme();
  const configured = appearance?.theme;
  const [override, setOverride] = useState<ThemeMode | null>(
    configured === 'system' ? null : configured ?? 'light',
  );
  // A forced mode (the liveness camera) sits ABOVE the person's choice rather
  // than replacing it, so handing it back returns exactly what they had.
  const [forcedMode, setForcedMode] = useState<ThemeMode | null>(null);
  const mode: ThemeMode = effectiveThemeMode(forcedMode, override, systemScheme);
  const setMode = setOverride as (mode: ThemeMode) => void;
  const colors = useMemo(() => resolveColors(mode, appearance), [mode, appearance]);
  const ownMode: ThemeMode = effectiveThemeMode(null, override, systemScheme);
  const ownColors = useMemo(
    () => (ownMode === mode ? colors : resolveColors(ownMode, appearance)),
    [ownMode, mode, colors, appearance],
  );
  const fontsLoaded = useMyazaFonts();

  // Applied here rather than at launch so a nested provider (a resolved
  // workflow's appearance taking over from the props') re-scales too. The
  // radius scale is a module-level object read during render, so setting it
  // while rendering this provider lands before any child reads it.
  applyRadiusScale(appearance?.borderRadius);

  // Only families that are actually REGISTERED come back. Applying a name RN
  // can't resolve is what made a configured font silently fall back to system —
  // the hook loads it first, then re-renders with it.
  const brandFonts = useBrandFonts(appearance?.fontFamily, appearance?.headingFontFamily);

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      colors,
      setMode,
      // Flip from the EFFECTIVE mode (which may be system-derived), so the
      // first toggle out of system mode lands on the opposite of what the
      // user is currently seeing.
      toggle: () => {
        if (forcedMode) return;
        setOverride(mode === 'dark' ? 'light' : 'dark');
      },
      forced: forcedMode != null,
      setForcedMode,
      ownColors,
      ownMode,
      fontsLoaded,
      brandFonts,
    }),
    [mode, colors, ownMode, ownColors, fontsLoaded, brandFonts, forcedMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Draws its children in the person's OWN theme while a screen has forced
 * another (the liveness camera forces light so the screen lights the face).
 * For chrome that is no part of that light: on a dark flow the back and close
 * buttons stay dark, as they do on the Flutter SDK.
 */
export function OwnTheme({ children }: { children: React.ReactNode }): React.ReactElement {
  const theme = useTheme();
  const value = useMemo<ThemeValue>(
    () => ({ ...theme, mode: theme.ownMode, colors: theme.ownColors }),
    [theme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Theme colors + light/dark mode controls. */
export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('Myaza KYC components must be rendered inside <MyazaThemeProvider>.');
  }
  return ctx;
}
