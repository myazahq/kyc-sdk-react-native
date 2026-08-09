/**
 * The brand-font loader rests on one non-obvious fact: Google Fonts serves a
 * different FORMAT per User-Agent — woff2 to browsers, TTF to anything it does
 * not recognise. React Native's fetch sends no browser UA, so it receives TTF,
 * which is the only format expo-font can load.
 *
 * These pin the CSS parsing against Google's real response shape. If the regex
 * ever stops matching, fonts silently stop applying on device — the exact
 * failure this loader was written to fix — so it is worth a test even though
 * the fetch itself is mocked.
 */

// Mirrors the extraction in components/brand-font.ts.
const extract = (css: string): string | undefined => {
  const ttf = /url\((https:\/\/[^)]+\.ttf)\)/i.exec(css)?.[1];
  return ttf ?? /url\((https:\/\/[^)]+)\)/i.exec(css)?.[1];
};

// A verbatim response from fonts.googleapis.com for a UA-less request.
const REAL_TTF_CSS = `@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrFJA.ttf) format('truetype');
}`;

describe('brand font URL extraction', () => {
  it('pulls the TTF out of the real UA-less response', () => {
    expect(extract(REAL_TTF_CSS)).toBe(
      'https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrFJA.ttf',
    );
  });

  it('prefers a .ttf even when a woff2 appears first', () => {
    // Belt and braces: if Google ever serves us a mixed sheet, RN cannot use
    // woff2 and would register a font that fails to render.
    const mixed = `
      src: url(https://fonts.gstatic.com/s/a/x.woff2) format('woff2');
      src: url(https://fonts.gstatic.com/s/a/x.ttf) format('truetype');`;
    expect(extract(mixed)).toBe('https://fonts.gstatic.com/s/a/x.ttf');
  });

  it('still returns something when the path carries no extension', () => {
    const noExt = `src: url(https://fonts.gstatic.com/l/font?kit=abc123) format('truetype');`;
    expect(extract(noExt)).toBe('https://fonts.gstatic.com/l/font?kit=abc123');
  });

  it('returns undefined rather than a partial match on an error page', () => {
    expect(extract('<!doctype html><h1>404</h1>')).toBeUndefined();
    expect(extract('')).toBeUndefined();
  });
});
