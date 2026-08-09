import { brandMarkColor } from '../config/brand';

/**
 * The footer mark is Myaza's attribution, so it must never take a colour from
 * the ORG's palette — an org whose brand sits near ours would otherwise get a
 * mark that stops reading as Myaza, or vanishes into their background.
 *
 * Mirrors the web SDK's brand.test.ts; the two implementations must agree.
 */
const NEUTRALS = ['#070330', '#F6F5FE'];

const lum = (h: string) => {
  const x = h.replace('#', '');
  const c = (i: number) => {
    const s = parseInt(x.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(0) + 0.7152 * c(2) + 0.0722 * c(4);
};
const cr = (a: string, b: string) => {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

describe('brandMarkColor (React Native)', () => {
  it('only ever returns a neutral tone', () => {
    for (const bg of ['#FFFFFF', '#040218', '#fcf7f2', '#FF6B00', '#0EA5E9']) {
      expect(NEUTRALS).toContain(brandMarkColor(bg));
    }
  });

  it('stays legible on the SDK defaults', () => {
    expect(cr(brandMarkColor('#FFFFFF'), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(cr(brandMarkColor('#040218'), '#040218')).toBeGreaterThanOrEqual(4.5);
  });

  it('stays legible on a saturated brand background', () => {
    for (const bg of ['#5645F5', '#FFC107', '#14532D']) {
      expect(cr(brandMarkColor(bg), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('handles an arbitrary org background, not just light and dark', () => {
    for (const bg of ['#fcf7f2', '#110c1a', '#40196d', '#FFEB3B', '#14532D']) {
      // eslint-disable-next-line no-console -- names the failing background
      if (cr(brandMarkColor(bg), bg) < 4.5) console.error('failed background:', bg);
      expect(cr(brandMarkColor(bg), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('falls back safely on a malformed background', () => {
    expect(brandMarkColor('nonsense')).toBe(brandMarkColor('#FFFFFF'));
  });
});
