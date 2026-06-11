// ---------------------------------------------------------------------------
// Design tokens — ported from the Flutter SDK's `theme.dart` (MyazaColorScheme)
// and the web SDK's `globals.css`. Token-based so `appearance` overrides cascade
// (mirrors Flutter's `_applyAppearance`): set `primaryColor` and the whole tint
// family follows.
// ---------------------------------------------------------------------------

import type { KYCAppearance } from '../types/config';

export interface MyazaColorScheme {
  background: string;
  backgroundSecondary: string;
  textDark: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  /** Text/icon color on top of `primary` (e.g. button labels). */
  onPrimary: string;
  primary50: string;
  primary100: string;
  primary200: string;
  gray300: string;
  gray400: string;
  success: string;
  successBg: string;
  error: string;
  errorBg: string;
  warning: string;
  warningBg: string;
  info: string;
  infoBg: string;
}

export const LIGHT_COLORS: MyazaColorScheme = {
  background: '#FFFFFF',
  backgroundSecondary: '#F6F5FE',
  textDark: '#070330',
  textSecondary: '#5A5775',
  textMuted: '#828197',
  border: '#D3CFFC',
  primary: '#5645F5',
  onPrimary: '#FFFFFF',
  primary50: '#F6F5FE',
  primary100: '#E9E7FE',
  primary200: '#D3CFFC',
  gray300: '#CDCDD6',
  gray400: '#ACABBA',
  success: '#0DA211',
  successBg: '#D8F4DC',
  error: '#BD1B09',
  errorBg: '#FCD8D8',
  warning: '#FFC107',
  warningBg: '#FFF1D6',
  info: '#004FAF',
  infoBg: '#C8E9FF',
};

export const DARK_COLORS: MyazaColorScheme = {
  background: '#040218',
  backgroundSecondary: '#0F0C2E',
  textDark: '#F6F5FE',
  textSecondary: '#ACABBA',
  textMuted: '#5A5775',
  border: '#302D53',
  primary: '#7B6EF7',
  onPrimary: '#FFFFFF',
  primary50: '#1A1730',
  primary100: '#2A2651',
  primary200: '#3D3870',
  gray300: '#302D53',
  gray400: '#5A5775',
  success: '#0DA211',
  successBg: '#0B2B0C',
  error: '#BD1B09',
  errorBg: '#2B0A0A',
  warning: '#FFC107',
  warningBg: '#2B1B00',
  info: '#004FAF',
  infoBg: '#001B3B',
};

export type ThemeMode = 'light' | 'dark';

export const radius = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const sizing = {
  buttonHeight: 48,
  inputHeight: 48,
  iconSize: 24,
  avatarSize: 80,
  cameraCircleSize: 260,
} as const;

/** Font families — registered via `expo-font` (see `loadMyazaFonts`). */
export const fonts = {
  heading: 'SpaceGrotesk_700Bold',
  headingSemibold: 'SpaceGrotesk_600SemiBold',
  body: 'Karla_400Regular',
  bodyMedium: 'Karla_500Medium',
  bodySemibold: 'Karla_600SemiBold',
} as const;

// ---------------------------------------------------------------------------
// Color helpers — hex parsing + alpha blend (for deriving tints from primary)
// ---------------------------------------------------------------------------

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function toHex({ r, g, b }: Rgb): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Alpha-blends `fg` over `bg` at opacity `alpha` (0–1). */
function alphaBlend(fg: string, bg: string, alpha: number): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  if (!f || !b) return fg;
  return toHex({
    r: f.r * alpha + b.r * (1 - alpha),
    g: f.g * alpha + b.g * (1 - alpha),
    b: f.b * alpha + b.b * (1 - alpha),
  });
}

// ---------------------------------------------------------------------------
// Appearance mapping — overlay KYCAppearance onto a base scheme.
// Mirrors Flutter's `_applyAppearance`: when `primaryColor` is set, derive the
// 50/100/200 tint family from it (alpha-blended over the background); an explicit
// `accentColor` overrides the 100 tint.
// ---------------------------------------------------------------------------

export function applyAppearance(
  base: MyazaColorScheme,
  appearance: KYCAppearance | undefined,
): MyazaColorScheme {
  if (!appearance) return base;

  const background = appearance.backgroundColor ?? base.background;
  const next: MyazaColorScheme = {
    ...base,
    background,
    backgroundSecondary: appearance.surfaceColor ?? base.backgroundSecondary,
    border: appearance.borderColor ?? base.border,
    textDark: appearance.textColor ?? base.textDark,
    onPrimary: appearance.primaryTextColor ?? base.onPrimary,
  };

  if (appearance.primaryColor) {
    next.primary = appearance.primaryColor;
    next.primary50 = alphaBlend(appearance.primaryColor, background, 0.04);
    next.primary100 = alphaBlend(appearance.primaryColor, background, 0.1);
    next.primary200 = alphaBlend(appearance.primaryColor, background, 0.2);
  }
  if (appearance.accentColor) {
    next.primary100 = appearance.accentColor;
  }

  return next;
}

/** Resolves the active color scheme for a mode + appearance override. */
export function resolveColors(mode: ThemeMode, appearance?: KYCAppearance): MyazaColorScheme {
  return applyAppearance(mode === 'dark' ? DARK_COLORS : LIGHT_COLORS, appearance);
}

/**
 * Surface tint for the KYC header chrome — mirrors Flutter's `kycHeaderSurface`.
 * Dark themes get a branded lift over the background; light themes use the
 * subtle secondary surface.
 */
export function headerSurface(colors: MyazaColorScheme, mode: ThemeMode): string {
  return mode === 'dark' ? alphaBlend(colors.primary, colors.background, 0.18) : colors.backgroundSecondary;
}
