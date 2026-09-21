import { Image } from 'react-native';

import { resolveBaseUrl } from '../services/resolveUrl';
import type { LivenessChallenge } from './types';

// ---------------------------------------------------------------------------
// Where the gesture animations come from.
//
// They used to be four GIFs bundled in this package — 5.5 MB, shipped to every
// device whatever the workflow asked for, for a badge that is on screen for a
// few seconds of the liveness step. They are served by the API instead
// (`/api/kyc/assets/liveness/<gesture>.gif`), prefetched when the flow opens,
// and cached by the platform image loader from then on.
//
// GIF on BOTH platforms deliberately, even though the server also has WebP at a
// tenth of the size: React Native decodes only GIF animation on iOS, and
// animated WebP on Android needs Fresco's `animated-webp` module, which the
// host app enables or does not — invisible from in here. One URL, no platform
// branch, no dependence on the integrator's Fresco configuration.
//
// Nothing here throws and nothing here is awaited by the flow. A device that
// never gets the file shows the gesture icon the avatar has always fallen back
// to, and the instruction text above it says what to do regardless.
// ---------------------------------------------------------------------------

export function livenessAvatarUrl(
  challenge: LivenessChallenge,
  apiKey: string,
  devUrl?: string,
): string | null {
  try {
    // Throws on a malformed key, which is a real error everywhere else in the
    // SDK and merely a missing cartoon here.
    return `${resolveBaseUrl(apiKey, devUrl)}/api/kyc/assets/liveness/${challenge}.gif`;
  } catch {
    return null;
  }
}

const GESTURES: readonly LivenessChallenge[] = ['nod', 'turn', 'blink', 'smile'];

/**
 * Warm the image cache at flow open, so the avatar is already on the device by
 * the time liveness renders.
 *
 * Called beside `primeFaceModel()` and for the same reason: the work overlaps
 * consent and ID-type selection instead of stalling in front of the camera.
 * All four are fetched because which gestures a session asks for is randomised
 * per session, and together they are under 700 KB.
 */
export function primeLivenessAvatars(apiKey: string, devUrl?: string): void {
  for (const gesture of GESTURES) {
    const url = livenessAvatarUrl(gesture, apiKey, devUrl);
    if (url == null) return;
    Image.prefetch(url).catch(() => {
      /* best-effort: the avatar falls back to its icon */
    });
  }
}
