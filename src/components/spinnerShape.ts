// The loading spinner's drawing and sizes, apart from the component so they
// can be tested without React Native. See components/Spinner.tsx.
//
// The PATH is copied from the icon the web SDK and the dashboard spin (their
// `Loader2`, Hugeicons' Loading02), not redrawn: change it here and in the
// Flutter SDK (widgets/myaza_spinner.dart) together.

/** Hugeicons Loading02 (stroke rounded), on a 24 x 24 box. */
export const SPINNER_PATH =
  'M18.001 20C16.3295 21.2558 14.2516 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 12.8634 21.8906 13.7011 21.6849 14.5003C21.4617 15.3673 20.5145 15.77 19.6699 15.4728C18.9519 15.2201 18.6221 14.3997 18.802 13.66C18.9314 13.1279 19 12.572 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19C13.3197 19 14.554 18.6348 15.6076 18';

/** The stroke the SDKs draw every icon at (the web's `strokeWidth = 1.6`). */
export const SPINNER_STROKE = 1.6;
/** One turn, as the web's `animate-spin`. */
export const SPINNER_TURN_MS = 1000;

const NAMED = { small: 20, large: 32 } as const;

/** The spinner's side in points for a size given the way the platform indicator took it. */
export function spinnerSize(size: number | 'small' | 'large' | undefined): number {
  if (typeof size === 'number') return size;
  return NAMED[size ?? 'small'];
}

/** The spinner's side for a loader box: all of a small box, half of a large one (80 gives 40, 64 the web's 32). */
export function loaderSpinnerSize(box: number): number {
  return box <= 32 ? box : Math.round(box / 2);
}
