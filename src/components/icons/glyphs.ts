import type { IconSvgElement } from '@hugeicons/react-native';

/**
 * Glyphs Hugeicons does not carry, drawn in the set's own stroke language.
 *
 * Kept to the strict minimum: every other icon comes from the set, and this
 * file exists only where the set has no equivalent at all. It MIRRORS the web
 * SDK's `components/icons/glyphs.ts` - same geometry, same stroke attributes -
 * so the two platforms draw one arrow rather than two near-misses.
 */

const STROKE = {
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: '1.5',
} as const;

/**
 * A LONG left arrow - a full-width shaft with a small head.
 *
 * Hugeicons has no such glyph. Its longest one-way left arrow is
 * `ArrowLeft02Icon`, whose shaft spans 13.5 of the 24-unit viewBox; the rest
 * are shorter, bare chevrons, or arrows into a vertical bar. This SDK's back
 * control drew Lucide's `MoveLeft` before the migration, whose shaft is 20
 * units, so moving to the set would visibly shorten it.
 *
 * The geometry is Lucide's, inset to sit on the same optical margins as its
 * Hugeicons siblings (they start at ~3.5 rather than Lucide's 2), and the
 * stroke attributes are copied from the set so weight and joins match exactly.
 */
export const LONG_ARROW_LEFT: IconSvgElement = [
  ['path', { d: 'M20.5 12H3.5', ...STROKE, key: '0' }],
  ['path', { d: 'M8 7.5L3.5 12L8 16.5', ...STROKE, key: '1' }],
];
