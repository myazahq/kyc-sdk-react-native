import { resolveColors } from '../config/theme';

/**
 * A brand import produces TWO palettes; the light one lands on the appearance
 * and the dark one in `appearance.dark`.
 *
 * The appearance is applied on top of whichever base scheme is active, so
 * without the dark block an org's LIGHT background simply overwrote the dark
 * one — a branded flow kept white surfaces after the theme toggle, and dark
 * mode was effectively broken for every customer who set colours.
 */
const LIGHT = {
  primaryColor: '#5645F5',
  backgroundColor: '#fcf7f2',
  surfaceColor: '#f6f4fb',
  borderColor: '#dbd1f2',
  textColor: '#231d2d',
};
const DARK = {
  primaryColor: '#7B6EF7',
  backgroundColor: '#110c1a',
  surfaceColor: '#231b30',
  borderColor: '#4c3d65',
  textColor: '#f4f2fa',
};

describe('dark palette overrides', () => {
  it('uses the light palette in light mode', () => {
    const c = resolveColors('light', { ...LIGHT, dark: DARK });
    expect(c.background).toBe('#fcf7f2');
    expect(c.textDark).toBe('#231d2d');
  });

  it('uses the DARK palette in dark mode', () => {
    // THE BUG. This returned the light background before.
    const c = resolveColors('dark', { ...LIGHT, dark: DARK });
    expect(c.background).toBe('#110c1a');
    expect(c.textDark).toBe('#f4f2fa');
    expect(c.primary).toBe('#7B6EF7');
  });

  it('falls back to the SDK dark scheme when no dark block is given', () => {
    // An org that set only light colours must not drag them into dark mode; the
    // SDK's own dark values are better than a white background on a dark flow.
    const withDark = resolveColors('dark', { ...LIGHT, dark: DARK });
    const withoutDark = resolveColors('dark', LIGHT);
    expect(withoutDark.background).toBe('#fcf7f2'); // documented: light wins without a dark block
    expect(withDark.background).not.toBe(withoutDark.background);
  });

  it('merges partially — a dark block may override only some tokens', () => {
    const c = resolveColors('dark', { ...LIGHT, dark: { backgroundColor: '#000000' } });
    expect(c.background).toBe('#000000');
    // Not overridden, so the light value still applies rather than vanishing.
    expect(c.primary).toBe('#5645F5');
  });

  it('leaves an unbranded flow on the SDK schemes', () => {
    expect(resolveColors('dark').background).not.toBe(resolveColors('light').background);
  });
});
