import { cardCropRect } from '../services/cardCrop';
import { CARD_GUIDE_ASPECT, PASSPORT_GUIDE_ASPECT } from '../config/idTypes';

describe('cardCropRect', () => {
  it('produces a crop whose aspect equals the guide aspect', () => {
    const r = cardCropRect(4000, 3000, CARD_GUIDE_ASPECT);
    expect(r.width / r.height).toBeCloseTo(CARD_GUIDE_ASPECT, 3);
  });

  it('stays within the image bounds', () => {
    for (const [w, h] of [
      [4000, 3000], // landscape sensor
      [3000, 4000], // portrait sensor
      [1920, 1080], // 16:9
    ] as const) {
      const r = cardCropRect(w, h, CARD_GUIDE_ASPECT);
      expect(r.originX).toBeGreaterThanOrEqual(0);
      expect(r.originY).toBeGreaterThanOrEqual(0);
      expect(r.originX + r.width).toBeLessThanOrEqual(w + 0.01);
      expect(r.originY + r.height).toBeLessThanOrEqual(h + 0.01);
    }
  });

  it('centres the crop within the cover-fit 3:4 slice (landscape sensor)', () => {
    // 4000×3000 → visible slice is 2250×3000 centred at x=875.
    const r = cardCropRect(4000, 3000, CARD_GUIDE_ASPECT);
    const sliceCentreX = 875 + 2250 / 2;
    expect(r.originX + r.width / 2).toBeCloseTo(sliceCentreX, 3);
    expect(r.originY + r.height / 2).toBeCloseTo(3000 / 2, 3); // vertically centred (no shift)
  });

  it('gives passports a taller crop (smaller aspect) than ID cards', () => {
    const card = cardCropRect(4000, 3000, CARD_GUIDE_ASPECT);
    const passport = cardCropRect(4000, 3000, PASSPORT_GUIDE_ASPECT);
    expect(passport.height).toBeGreaterThan(card.height);
    expect(passport.width).toBeCloseTo(card.width, 3); // same 88% width
    expect(passport.width / passport.height).toBeCloseTo(PASSPORT_GUIDE_ASPECT, 3);
  });
});

describe('full-screen viewport (the regression the user caught on device)', () => {
  it('a full-screen crop is much narrower than the stale 3:4 assumption', () => {
    // 1080×2400 screen, 3024×4032 photo, ID-1 guide. The photo cover-fits a
    // 0.45 viewport by HEIGHT, so the visible slice is only 4032·0.45 ≈ 1814px
    // wide — the 3:4 assumption took 3024·(3/4-slice) and cropped ~1.67× more
    // scene than the user ever saw.
    const full = cardCropRect(3024, 4032, 1.586, 1080 / 2400);
    const stale = cardCropRect(3024, 4032, 1.586);
    expect(full.width).toBeLessThan(stale.width * 0.7);
    // 88% of the visible slice, exactly.
    expect(full.width).toBeCloseTo(4032 * (1080 / 2400) * 0.88, 0);
    // Still centred and inside the photo.
    expect(full.originX).toBeGreaterThan(0);
    expect(full.originX + full.width).toBeLessThan(3024);
    expect(full.width / full.height).toBeCloseTo(1.586, 3);
  });

  it('defaults to the framed 3:4 box when no viewport is given', () => {
    const a = cardCropRect(3000, 4000, 1.586);
    const b = cardCropRect(3000, 4000, 1.586, 3 / 4);
    expect(a).toEqual(b);
  });
});
