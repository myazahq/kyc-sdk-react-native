// Imported from the PURE resolver, not components/fonts — the latter pulls in
// expo-font, which jest cannot parse out of node_modules.
import {
  fontFamilyFor,
  markFamilyName,
  brandFamilyName,
  BRAND_WEIGHTS,
} from '../config/font-resolve';

/**
 * Text was being CLIPPED — "Continue" rendered as "Continu" — and the cause was
 * synthetic bolding, not font width.
 *
 * If a single regular font file is registered and the style asks for
 * `fontWeight: '600'`, the platform fakes the bold: it smears the glyphs wider
 * AFTER the text has been measured, so the layout box is sized for the regular
 * face and the rendered text overflows it. Registering a real file per weight
 * removes the synthesis, so measurement matches rendering.
 *
 * These pin the invariant that makes that true: the weight is always resolved
 * INTO the family name, so the call site can clear `fontWeight` unconditionally.
 */
describe('brand font weight resolution', () => {
  const brand = { body: 'Poppins', heading: 'Poppins' };

  it('maps each rendered weight to its own registered family', () => {
    expect(fontFamilyFor(false, '400', true, brand)).toBe('Poppins');
    expect(fontFamilyFor(false, '500', true, brand)).toBe('Poppins__500');
    expect(fontFamilyFor(false, '600', true, brand)).toBe('Poppins__600');
    expect(fontFamilyFor(false, '700', true, brand)).toBe('Poppins__700');
  });

  it('treats every bold alias as 700 rather than leaving it to synthesis', () => {
    for (const w of ['bold', '800', '900'] as const) {
      expect(fontFamilyFor(false, w, true, brand)).toBe('Poppins__700');
    }
  });

  it('resolves a family for EVERY weight the SDK renders', () => {
    // A weight with no registered family would fall back to synthesis — the
    // exact failure this fixes — so the loader and the resolver must agree.
    for (const w of BRAND_WEIGHTS) {
      const resolved = fontFamilyFor(false, String(w) as never, true, brand);
      expect(resolved).toBe(brandFamilyName('Poppins', w));
    }
  });

  it('sends headings to the heading family, falling back to body', () => {
    expect(fontFamilyFor(true, '700', true, { body: 'Inter', heading: 'Lora' })).toBe('Lora__700');
    expect(fontFamilyFor(true, '700', true, { body: 'Inter' })).toBe('Inter__700');
  });

  it('still uses the bundled families when no brand font is set', () => {
    expect(fontFamilyFor(false, '400', true, {})).toBe('Karla_400Regular');
    expect(fontFamilyFor(true, '700', true, {})).toBe('SpaceGrotesk_700Bold');
  });

  it('renders nothing custom until the bundled fonts are loaded', () => {
    expect(fontFamilyFor(false, '400', false, {})).toBeUndefined();
  });
});

describe('the footer wordmark is immune to the org font', () => {
  const ORG = { body: 'Poppins', heading: 'Fraunces' };

  it('renders TRUST in bundled Karla even when the workflow sets a font', () => {
    // "TRUST" is part of a wordmark. Taking the customer's typeface would
    // redraw someone else's logo — and it is what RN was doing while web and
    // Flutter pinned the brand face.
    expect(markFamilyName('600', true)).toBe('Karla_600SemiBold');
    // The very same inputs, through the normal path, DO take the org font —
    // which is the behaviour the mark has to opt out of.
    expect(fontFamilyFor(false, '600', true, ORG)).toBe('Poppins__600');
  });

  it('ignores the org font at every weight', () => {
    const cases: Array<[string, string]> = [
      ['400', 'Karla_400Regular'],
      ['500', 'Karla_500Medium'],
      ['600', 'Karla_600SemiBold'],
      ['700', 'Karla_700Bold'],
      ['bold', 'Karla_700Bold'],
    ];
    for (const [weight, expected] of cases) {
      expect(markFamilyName(weight as never, true)).toBe(expected);
      expect(markFamilyName(weight as never, true)).not.toContain('Poppins');
    }
  });

  it('falls back to the platform face before the fonts load', () => {
    // RN has no font STACK — a family either matches a registered one or
    // nothing — so undefined is how it does what web's `system-ui` fallback
    // does. Naming an unloaded family would render a silent blank.
    expect(markFamilyName('600', false)).toBeUndefined();
  });

  it('never encodes a weight the platform would have to synthesise', () => {
    // Same invariant as the rest of the type system here: synthetic bold
    // smears glyphs wider than they were measured, which clips text.
    for (const w of ['400', '500', '600', '700'] as const) {
      const family = markFamilyName(w, true);
      expect(family).toBeDefined();
      expect(family).toMatch(/^Karla_(400Regular|500Medium|600SemiBold|700Bold)$/);
    }
  });
});
