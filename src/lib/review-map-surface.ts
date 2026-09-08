// The review card's map falls back in the SAME order on every SDK: the picture
// (the Maps Static API through the server), then the framed Google map the pin
// step drew, then the built-in tiles. Pure, so a test can pin the order — the
// Flutter card skipped the middle rung and confirmed the address on
// OpenStreetMap where RN confirmed it on Google (user report 2026-09-08).
// Mirrors kyc-sdk-flutter's reviewMapSurface; keep the two in lockstep.

export type ReviewMapSurface = 'stub' | 'picture' | 'pending' | 'framed' | 'builtIn';

export function reviewMapSurface(facts: {
  vendorsStubbed: boolean;
  /** The picture's bytes have landed. */
  hasStaticMap: boolean;
  /** The picture was refused (a project without the Static API 404s). */
  staticMapFailed: boolean;
  /** A server-minted maps frame URL this install can render. */
  hasFrame: boolean;
}): ReviewMapSurface {
  if (facts.vendorsStubbed) return 'stub';
  if (facts.hasStaticMap) return 'picture';
  // Nothing to draw yet and no verdict either: hold the picture's space rather
  // than flashing the live map for the half second before the bytes land.
  if (!facts.staticMapFailed) return 'pending';
  if (facts.hasFrame) return 'framed';
  return 'builtIn';
}
