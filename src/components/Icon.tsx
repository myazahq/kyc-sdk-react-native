import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ICONS, type IconName } from './icon-map';

export type { IconName } from './icon-map';

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  /** Render a solid/filled glyph (used for the theme toggle, matching Flutter's filled moon/sun). */
  solid?: boolean;
}

export function Icon({ name, size = 20, color, strokeWidth = 2, solid = false }: IconProps): React.ReactElement {
  // Solid moon/sun for the theme toggle — Lucide has no filled variants, so use
  // Ionicons' purpose-built solid glyphs (matches Flutter's dark_mode/light_mode).
  if (solid && (name === 'moon' || name === 'sun')) {
    return <Ionicons name={name === 'moon' ? 'moon' : 'sunny'} size={size} color={color} />;
  }
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
}
