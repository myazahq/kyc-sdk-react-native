import React from 'react';

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
  const Glyph = ICONS[name];
  // The theme toggle's filled moon/sun (Flutter's dark_mode/light_mode). Lucide
  // ships no filled variants, so the glyph's own body takes the colour: the
  // moon's crescent and the sun's disc fill, the sun's rays stay strokes. This
  // replaced an Ionicons import that was the SDK's ONLY use of
  // @expo/vector-icons, a package whose icon fonts still reached every
  // integrator's app for those two glyphs (1.35 MB on a real release APK).
  const fill = solid && (name === 'moon' || name === 'sun') ? color : 'none';
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} fill={fill} />;
}
