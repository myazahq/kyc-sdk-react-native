import { resolveColors, DARK_COLORS } from '../config/theme';

// ─── A brand tint composites against the surface it is drawn on ──────────────
//
// `primary50/100/200` are the faint brand washes behind markers, pills and
// selected rows. They are drawn on several different surfaces - the sheet
// (`background`), a card (`backgroundSecondary`), a pill - so a derivation that
// pre-blends has to pick ONE of them and is wrong everywhere else.
//
// It picked `background`. On a card, the 10% tint then landed within 3/255 of
// the card it sat on, and the supporting-documents step drew its numbered
// markers invisibly while the web SDK drew them clearly (user report
// 2026-09-25). Web never had the bug because `bg-primary/10` is real alpha and
// CSS composites it against whatever is behind it.
//
// So these carry alpha now. The tests below pin both halves of that: visible on
// a card, and unchanged on the background it used to be blended against.

const BRAND = '#5645F5';

/** Composite an 8-digit hex over an opaque one, the way the platform will. */
function over(fg: string, bg: string): string {
  const hex = (s: string) => s.replace('#', '');
  const f = hex(fg);
  const b = hex(bg);
  const alpha = f.length === 8 ? parseInt(f.slice(6, 8), 16) / 255 : 1;
  const ch = (i: number) => {
    const fv = parseInt(f.slice(i * 2, i * 2 + 2), 16);
    const bv = parseInt(b.slice(i * 2, i * 2 + 2), 16);
    return Math.round(fv * alpha + bv * (1 - alpha));
  };
  return `#${[0, 1, 2].map((i) => ch(i).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

const distance = (a: string, b: string) => {
  const rgb = (s: string) => [0, 1, 2].map((i) => parseInt(s.replace('#', '').slice(i * 2, i * 2 + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return Math.max(...x.map((v, i) => Math.abs(v - y[i]!)));
};

describe('a branded tint composites against its own surface', () => {
  const branded = () => resolveColors('dark', { primaryColor: BRAND });

  it('carries an alpha channel rather than a pre-blend', () => {
    for (const tint of [branded().primary50, branded().primary100, branded().primary200]) {
      expect(tint).toMatch(/^#[0-9a-fA-F]{8}$/);
    }
  });

  it('is clearly visible on a card, which is where it was invisible', () => {
    const card = DARK_COLORS.backgroundSecondary;
    // The old pre-blend was 3/255 from the card. Anything that low reads as
    // nothing at all on a phone.
    expect(distance(over(branded().primary100, card), card)).toBeGreaterThan(12);
  });

  it('draws exactly what the web SDK draws, which is the whole point', () => {
    // Web: `bg-primary/10` over `--secondary`, both the same values here.
    expect(over(branded().primary100, DARK_COLORS.backgroundSecondary)).toBe('#161242');
  });

  it('is unchanged on the background it used to be blended against', () => {
    // Nothing that was already correct is allowed to move. Not byte-identical:
    // an alpha byte cannot hold 0.1 exactly (0x1A is 0.1019…), which moves a
    // channel by at most 1/255. That is below anything a screen can show, and
    // the alternative - keeping the pre-blend - is the bug.
    expect(distance(over(branded().primary100, DARK_COLORS.background), '#0C092E')).toBeLessThanOrEqual(1);
    expect(distance(over(branded().primary50, DARK_COLORS.background), '#070521')).toBeLessThanOrEqual(1);
  });

  it('leaves the hand-tuned defaults alone when no brand colour is set', () => {
    expect(resolveColors('dark').primary100).toBe(DARK_COLORS.primary100);
  });

  it('still blends a non-hex brand colour rather than throwing', () => {
    const named = resolveColors('dark', { primaryColor: 'rebeccapurple' });
    expect(named.primary100).toBeTruthy();
    expect(named.primary100).not.toMatch(/^#[0-9a-fA-F]{8}$/);
  });
});
