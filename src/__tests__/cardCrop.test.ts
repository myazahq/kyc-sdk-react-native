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
