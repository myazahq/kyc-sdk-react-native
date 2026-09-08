import { useEffect, useState } from 'react';

// ─── Server-side pictures, fetched with the SDK's own bearer ────────────────
//
// The review card's two pictures (the static map, the framed Street View)
// come through OUR server, so the request has to carry the SDK's bearer.
// React Native's <Image> accepts `source.headers` for exactly this and honours
// it on iOS; on Android (RN 0.85, new architecture) the header never leaves
// the device: the server answered 401 to every thumbnail request and the card
// drew an empty bordered box where the entrance should have been (Galaxy S24,
// 2026-09-07). So the bytes are fetched with the same `fetch` the API client
// uses, which carries headers on both platforms, and <Image> is handed a data
// URI it cannot get wrong. The bytes are base64-encoded here rather than via
// Blob + FileReader, which RN's fetch cannot supply (see bytesToBase64).

export interface AuthedImageSource {
  uri: string;
  headers: Record<string, string>;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Plain base64, in JS. React Native's `Response.blob()` cannot build a Blob
 *  from the ArrayBuffer its own fetch holds ("Creating blobs from
 *  'ArrayBuffer' … are not supported"), so Blob and FileReader are out; a
 *  thumbnail is tens of kilobytes and this loop is nothing. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64.charAt((triple >> 18) & 63) + B64.charAt((triple >> 12) & 63);
    out += i + 1 < bytes.length ? B64.charAt((triple >> 6) & 63) : '=';
    out += i + 2 < bytes.length ? B64.charAt(triple & 63) : '=';
  }
  return out;
}

export async function fetchImageDataUri(source: AuthedImageSource, signal?: AbortSignal): Promise<string> {
  const res = await fetch(source.uri, { headers: source.headers, signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  const bytes = new Uint8Array(await res.arrayBuffer());
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

export interface AuthedImage {
  /** The picture as a data URI once it has arrived. */
  uri: string | null;
  /** It never will: the request was refused or the bytes were unreadable. */
  failed: boolean;
}

const IDLE: AuthedImage = { uri: null, failed: false };

/** One server picture, keyed on its URL; `label` names it in the dev log. */
export function useAuthedImage(source: AuthedImageSource | null, label: string): AuthedImage {
  const [state, setState] = useState<AuthedImage>(IDLE);
  const key = source?.uri ?? null;
  useEffect(() => {
    setState(IDLE);
    if (!source) return undefined;
    const controller = new AbortController();
    fetchImageDataUri(source, controller.signal)
      .then((uri) => setState({ uri, failed: false }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (__DEV__) console.warn(`${label} failed to load`, err);
        setState({ uri: null, failed: true });
      });
    return () => controller.abort();
    // The headers are the SDK's own and never change; the URL is the picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
