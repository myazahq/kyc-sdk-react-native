import type { LatLng } from './map-tiles';

// The framed Google-map picker's client half, for a WebView (the OkHi model):
// the SDK loads OUR hosted /embed/map page TOP-LEVEL in a WebView and talks to
// it over the WebView's own bridge. A mirror of the web SDK's lib/map-frame.ts
// and the Flutter SDK's config/map_frame.dart — keep the three in lockstep.
//
// Message shapes (add-only; the page mirrors them):
//   page -> app: { source: 'myaza-map', type: 'ready' | 'failed' }
//                { source: 'myaza-map', type: 'pin', lat, lng }
//   app -> page: window.__myazaMapCommand(JSON of
//                { source: 'myaza-sdk', type: 'center', lat, lng, zoom? })

export const MAP_FRAME_SOURCE = 'myaza-map';
export const MAP_PARENT_SOURCE = 'myaza-sdk';

/** How long to wait for `ready` before falling back to the OSM picker.
 *  Generous: the page loads Google's script on a cold cache. */
export const MAP_FRAME_READY_TIMEOUT_MS = 8000;

export interface MapFrameOptions {
  center: LatLng;
  zoom: number;
  /** Recentre-and-zoom-in when the app already holds a pin. */
  hasPin: boolean;
  theme?: 'light' | 'dark';
  primaryColor?: string;
}

/** The full page URL: the server-minted frame URL (which already carries the
 *  signed APP grant and `mode=app`) plus the render-time parameters. There is
 *  no `origin` — an app has none, and the page proves that instead. */
export function buildMapFrameSrc(frameUrl: string, opts: MapFrameOptions): string {
  const url = new URL(frameUrl);
  url.searchParams.set('lat', String(opts.center.lat));
  url.searchParams.set('lng', String(opts.center.lng));
  url.searchParams.set('zoom', String(opts.hasPin ? 16 : opts.zoom));
  if (opts.theme) url.searchParams.set('theme', opts.theme);
  if (opts.primaryColor) url.searchParams.set('primary', opts.primaryColor);
  return url.toString();
}

export type MapFrameMessage =
  | { type: 'ready' }
  | { type: 'failed' }
  | { type: 'pin'; lat: number; lng: number };

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validate-and-drop: the bridge delivers strings, so a JSON string is
 *  accepted too; anything not shaped exactly like a frame message is null. */
export function parseMapFrameMessage(data: unknown): MapFrameMessage | null {
  let msg: unknown = data;
  if (typeof data === 'string') {
    try {
      msg = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as Record<string, unknown>;
  if (m.source !== MAP_FRAME_SOURCE) return null;
  if (m.type === 'ready') return { type: 'ready' };
  if (m.type === 'failed') return { type: 'failed' };
  if (m.type === 'pin' && finite(m.lat) && finite(m.lng)) {
    if (Math.abs(m.lat) > 90 || Math.abs(m.lng) > 180) return null;
    return { type: 'pin', lat: m.lat, lng: m.lng };
  }
  return null;
}

/** The recentre command as the script the WebView injects (Use my location,
 *  restored progress). Ends in `true` because injected scripts must resolve to
 *  something serialisable on iOS. */
export function centerCommandScript(pin: LatLng): string {
  const command = JSON.stringify({ source: MAP_PARENT_SOURCE, type: 'center', lat: pin.lat, lng: pin.lng, zoom: 16 });
  return `window.__myazaMapCommand && window.__myazaMapCommand(${JSON.stringify(command)}); true;`;
}

export function samePin(a: LatLng | null, b: LatLng): boolean {
  return !!a && Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;
}

// ── The framed STREET VIEW page (the entrance framing) ──────────────────────
//
// Same origin, same APP grant, sibling page: /embed/street-view lives beside
// /embed/map and the grant unlocks the key for either, so the SDK DERIVES its
// URL from the server-minted mapsFrameUrl by swapping the path — the two
// pages ship together with this SDK, and the coupling is recorded on both
// sides. The page is deliberately dumb: it renders the panorama and streams
// the current view (`sv-pov`) over the same bridge the map uses; the framing
// chrome, the frame-subtended fov maths and the capture decision stay in the
// SDK, so hosted, embedded and native applicants meet the identical
// instrument. Mirror of the web SDK's street-view half; keep in lockstep.
//
//   page -> app: { source: 'myaza-map', type: 'sv-ready' | 'sv-unavailable' }
//                { source: 'myaza-map', type: 'sv-pov', panoId, heading, pitch, viewFov }

/** The street-view page's URL derived from the map frame's, or null when the
 *  frame URL is not the page family this SDK knows. */
export function streetViewFrameUrlOf(mapsFrameUrl: string): string | null {
  try {
    const url = new URL(mapsFrameUrl);
    if (!url.pathname.endsWith('/embed/map')) return null;
    url.pathname = url.pathname.replace(/\/embed\/map$/, '/embed/street-view');
    return url.toString();
  } catch {
    return null;
  }
}

/** The full page URL: the derived page (carrying the signed APP grant and
 *  `mode=app`) plus the pin the panorama should look from. No `origin`: an
 *  app has none, and the page proves that instead. */
export function buildStreetViewFrameSrc(
  frameUrl: string,
  opts: { pin: LatLng; theme?: 'light' | 'dark' },
): string {
  const url = new URL(frameUrl);
  url.searchParams.set('lat', String(opts.pin.lat));
  url.searchParams.set('lng', String(opts.pin.lng));
  if (opts.theme) url.searchParams.set('theme', opts.theme);
  return url.toString();
}

export type StreetViewFrameMessage =
  | { type: 'sv-ready' }
  | { type: 'sv-unavailable' }
  | { type: 'sv-pov'; panoId: string; heading: number; pitch: number; viewFov: number };

/** Validate-and-drop for the street-view page's messages; a JSON string is
 *  accepted too, since the bridge delivers strings. */
export function parseStreetViewFrameMessage(data: unknown): StreetViewFrameMessage | null {
  let msg: unknown = data;
  if (typeof data === 'string') {
    try {
      msg = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as Record<string, unknown>;
  if (m.source !== MAP_FRAME_SOURCE) return null;
  if (m.type === 'sv-ready') return { type: 'sv-ready' };
  if (m.type === 'sv-unavailable') return { type: 'sv-unavailable' };
  if (
    m.type === 'sv-pov' &&
    typeof m.panoId === 'string' &&
    m.panoId.length > 0 &&
    finite(m.heading) &&
    finite(m.pitch) &&
    finite(m.viewFov)
  ) {
    return { type: 'sv-pov', panoId: m.panoId, heading: m.heading, pitch: m.pitch, viewFov: m.viewFov };
  }
  return null;
}
