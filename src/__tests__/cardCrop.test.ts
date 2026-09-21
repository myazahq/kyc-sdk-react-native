import { readFileSync } from 'fs';
import { join } from 'path';
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

describe('the crop is measured in the units it is applied in', () => {
  // The rect maths above was always right. What broke was its INPUT.
  //
  // Found on a TECNO KM5 (density 320 → scale 2.0), 2026-09-20: the applicant
  // framed a voter's card and the stored photo was a corner of the desk behind
  // it. `imageSize` used React Native's `Image.getSize`, which on Android
  // reports DP — pixels ÷ display density — while expo-image-manipulator crops
  // in real pixels. A 3048x4064 photo measured 1524x2032, so a rect computed as
  // perfectly centred was applied at half scale and landed in the UPPER-LEFT
  // QUADRANT of the real image.
  //
  // Every Android density is > 1, so this was every Android document capture,
  // wrong by the device's own density factor. iOS returns real pixels from
  // getSize and was unaffected, which is why an iPhone-led test history never
  // saw it. It fails silently: no crash, just a photo of the wrong thing that
  // fails OCR later and reads as the applicant's fault.
  //
  // Measuring through the manipulator means the ruler and the knife are the
  // same tool. A PixelRatio multiplier would also work today, but it re-states
  // the cropper's units elsewhere and leaves this one refactor away.
  it('imageSize does not use Image.getSize', () => {
    const source = readFileSync(
      join(__dirname, '../services/mediaCompress.ts'),
      'utf8',
    );
    // The CALL, not the name: the fix's own comment explains the old API, and
    // matching the bare name would fail on the explanation of why it is gone.
    expect(source).not.toMatch(/Image\.getSize\(/);
    expect(source).toMatch(/manipulate\([^)]*\)\.renderAsync\(\)/);
  });

  it('a rect built from half-scale dimensions lands off-centre — the bug, pinned', () => {
    // What the device actually did: measure 1524x2032, crop 3048x4064.
    const asMeasured = cardCropRect(1524, 2032, PASSPORT_GUIDE_ASPECT, 0.45);
    const trueCentreX = 3048 / 2;
    const centreOfRect = asMeasured.originX + asMeasured.width / 2;
    // Nowhere near the middle of the real image — it sits in the left third.
    expect(centreOfRect).toBeLessThan(trueCentreX * 0.7);

    // And measured correctly, it is centred.
    const correct = cardCropRect(3048, 4064, PASSPORT_GUIDE_ASPECT, 0.45);
    expect(correct.originX + correct.width / 2).toBeCloseTo(trueCentreX, 0);
    expect(correct.originY + correct.height / 2).toBeCloseTo(4064 / 2, 0);
  });
});
