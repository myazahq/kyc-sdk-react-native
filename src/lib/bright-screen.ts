// ---------------------------------------------------------------------------
// The bright screen during liveness: the pure decisions.
//
// While the liveness camera is on, the phone's screen is the light on the
// person's face. A dark theme and a dimmed display leave the face in shadow,
// which is what makes the gestures misread and the flash check come back
// inconclusive. So, while the camera is on:
//
//   1. the SDK renders in the LIGHT theme (the organisation's base palette,
//      never its dark overrides), faded in, and restored on the way out;
//   2. this app's screen brightness goes to full (a per-window override,
//      never the system setting), and is restored on the way out.
//
// `livenessBrightScreen: false` turns both off. The flash check's black
// baseline (flashOverlayPaint below) is NOT part of the switch: it is a
// measurement rule, and it holds whatever the organisation chose.
//
// Deliberately free of react-native imports, so the node test runner can pin
// every rule here.
// ---------------------------------------------------------------------------

import type { ThemeMode } from '../config/theme';

/** Absent means ON: only an explicit `false` turns the bright screen off. */
export function brightScreenEnabled(config: {
  livenessBrightScreen?: boolean | null;
}): boolean {
  return config.livenessBrightScreen !== false;
}

/**
 * The mode the flow renders in. A forced mode (the liveness camera) outranks
 * everything; then the person's own toggle; then the device's scheme.
 */
export function effectiveThemeMode(
  forced: ThemeMode | null,
  override: ThemeMode | null,
  system: string | null | undefined,
): ThemeMode {
  return forced ?? override ?? (system === 'dark' ? 'dark' : 'light');
}

/** Fade into the light theme; the way back is quicker, as exits should be. */
export const THEME_FADE_IN_MS = 300;
export const THEME_FADE_OUT_MS = 200;

/** How long the theme hand-over takes. Reduced motion: no fade at all. */
export function themeFadeMs(entering: boolean, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return entering ? THEME_FADE_IN_MS : THEME_FADE_OUT_MS;
}

/** The screen is only worth brightening while the app is actually in front. */
export function shouldBoostBrightness(input: {
  wanted: boolean;
  appState: string | null | undefined;
}): boolean {
  return input.wanted && input.appState === 'active';
}

/** What the flash overlay paints between two colours. */
export const FLASH_BASELINE_FILL = '#000000';

export interface FlashOverlayPaint {
  /** The overlay's colour. */
  fill: string;
  /** The "Hold still" line, readable on that colour. */
  text: string;
}

/**
 * The overlay during the flash sequence.
 *
 * The check measures the face against a neutral moment before each colour and
 * assumes the colour ADDS light. With a light (white) interface as that neutral
 * moment, the baseline is already brighter than most colours, and the
 * reflection it looks for can come out negative. So between colours the
 * overlay paints BLACK: the baseline stays dark whatever the theme or the
 * screen brightness, and each colour is a clear step up from it.
 *
 * Only called while the flash sequence runs; outside it there is no overlay.
 */
export function flashOverlayPaint(color: string | null): FlashOverlayPaint {
  if (!color) return { fill: FLASH_BASELINE_FILL, text: 'rgba(255,255,255,0.9)' };
  // Every palette colour is high-luminance, so white would be unreadable on
  // cyan and green: dark text on the colours.
  return { fill: color, text: 'rgba(0,0,0,0.8)' };
}

/**
 * Whether this render of the liveness step shows the LIVE camera: past the
 * "I'm ready" primer, the camera-permission primer and the face model, not
 * failed, and not yet on the review. Those primers keep the organisation's
 * normal theme and brightness (user decision 2026-09-28): only the camera
 * lights the face.
 */
export function livenessCameraOnScreen(input: {
  hasDevice: boolean;
  permission: 'priming' | 'requesting' | 'granted' | 'denied';
  /** The "I'm ready" primer has been acknowledged. */
  ready: boolean;
  modelState: string;
  phase: string;
  /** A selfie exists (uploaded, or captured and past the closing beat). */
  onReview: boolean;
}): boolean {
  return (
    input.hasDevice &&
    input.permission === 'granted' &&
    input.ready &&
    input.modelState === 'ready' &&
    input.phase !== 'failed' &&
    !input.onReview
  );
}

/**
 * The bright screen LATCHES: once the camera has been on screen in this visit
 * to the step, the review right after it (and anything else until the step is
 * left) stays light and bright, so the capture does not flip back to a dark
 * theme on the frame the selfie appears. A review reopened from an earlier
 * visit, with no camera this time, never latches.
 */
export function latchBrightScreen(latched: boolean, cameraOnScreen: boolean): boolean {
  return latched || cameraOnScreen;
}
