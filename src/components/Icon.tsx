import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react-native';

import { ICONS, type IconName } from './icons';

export type { IconName } from './icons';

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

/**
 * Every icon this SDK draws goes through here.
 *
 * The stroke is 1.6 to match the web SDK and the dashboard, which draw the
 * same set at that weight. It was 2 while this SDK drew Lucide, whose glyphs
 * are built for it.
 *
 * There is deliberately no `solid` prop. It existed to fill the theme toggle's
 * moon and sun, which worked because Lucide's glyph bodies take a fill.
 * Hugeicons' free pack is Stroke Rounded only - the solid styles are Pro - so
 * the toggle now draws stroked, which is what Flutter has always done.
 */
export function Icon({ name, size = 20, color, strokeWidth = 1.6 }: IconProps): React.ReactElement {
  return <HugeiconsIcon icon={ICONS[name]} size={size} color={color} strokeWidth={strokeWidth} />;
}
