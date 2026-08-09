import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { BRAND_WEIGHTS, brandFamilyName } from '../config/font-resolve';

export { BRAND_WEIGHTS, brandFamilyName };

/**
 * Load an org's brand font at runtime so a dashboard-picked family renders on
 * mobile.
 *
 * WHY: React Native resolves `fontFamily` against families the app has
 * REGISTERED — it never fetches. Setting `fontFamily: 'Poppins'` on a device
 * where Poppins was never bundled silently falls back. The web SDK injects a
 * stylesheet and Flutter has `google_fonts`; without this, RN was the one
 * platform where a configured font quietly did nothing.
 *
 * ONE FILE PER WEIGHT, and that is the important part. Registering a single
 * regular file and letting `fontWeight: '600'` ask the platform for a bolder
 * face makes iOS SYNTHESISE the bold — it smears the glyphs wider AFTER the
 * text has been measured, so the layout box is sized for the regular face and
 * the rendered text overflows it. That is what truncated "Continue" to
 * "Continu". Real weights are measured correctly, so nothing is clipped.
 *
 * This mirrors how the SDK's own Karla / Space Grotesk work: each weight is its
 * own registered family and `fontWeight` is cleared at the call site.
 *
 * HOW: Google Fonts serves a different FORMAT per User-Agent — woff2 to
 * browsers, TTF to anything it does not recognise. React Native's `fetch` sends
 * no browser UA, so the request below returns TTF, the only format expo-font can
 * load. Adding a browser-like UA here would return woff2 and break loading.
 */

/** One in-flight/settled attempt per family; the fetch is not free. */
const attempted = new Map<string, Promise<boolean>>();

async function loadGoogleFont(family: string): Promise<boolean> {
  try {
    const url =
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}` +
      `:wght@${BRAND_WEIGHTS.join(';')}&display=swap`;
    const css = await fetch(url).then((r) => (r.ok ? r.text() : ''));
    if (!css) return false;

    // Each @font-face carries its own weight + url. Pair them in document order
    // rather than assuming the response lists weights in the order requested.
    const faces = css.split('@font-face');
    const assets: Record<string, string> = {};
    for (const face of faces) {
      const weight = Number(/font-weight:\s*(\d+)/.exec(face)?.[1] ?? 0);
      const src = /url\((https:\/\/[^)]+)\)/.exec(face)?.[1];
      if (!weight || !src) continue;
      if (!(BRAND_WEIGHTS as readonly number[]).includes(weight)) continue;
      const name = brandFamilyName(family, weight);
      if (!Font.isLoaded(name)) assets[name] = src;
    }
    // A family with no 400 face is not usable as body text.
    if (!Font.isLoaded(family) && !assets[family]) return false;
    if (Object.keys(assets).length > 0) await Font.loadAsync(assets);
    return true;
  } catch {
    // A brand font is decoration on an identity flow — an offline device or a
    // blocked CDN must never affect a verification.
    return false;
  }
}

function ensure(family: string): Promise<boolean> {
  const existing = attempted.get(family);
  if (existing) return existing;
  const p = loadGoogleFont(family);
  attempted.set(family, p);
  return p;
}

/**
 * Returns the families SAFE TO APPLY — i.e. actually registered right now.
 *
 * A name is only returned once its font exists. Applying it eagerly is what
 * produced the silent fallback this fixes: RN needs the family to exist at the
 * moment the style is set, so the order must be load → apply → re-render.
 */
export function useBrandFonts(
  body?: string,
  heading?: string,
): { body?: string; heading?: string } {
  const [ready, setReady] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const wanted = [body, heading].filter((f): f is string => Boolean(f && f.trim()));
    if (wanted.length === 0) return;

    for (const family of wanted) {
      // Already bundled by the HOST APP (a self-hosted brand font) — usable
      // immediately, no fetch.
      if (Font.isLoaded(family)) {
        setReady((r) => (r[family] ? r : { ...r, [family]: true }));
        continue;
      }
      void ensure(family).then((ok) => {
        if (!cancelled && ok) setReady((r) => ({ ...r, [family]: true }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [body, heading]);

  return {
    body: body && ready[body] ? body : undefined,
    heading: heading && ready[heading] ? heading : undefined,
  };
}
