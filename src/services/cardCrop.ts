// Pure card-crop geometry — no native imports, so it's unit-testable in the
// plain-node jest env. The RN mirror of the math in the Flutter SDK's
// `_cropCardWorker`: the live-camera preview is shown BoxFit.cover in a fixed 3:4
// box with the ID-card guide centred at 88% width and `aspect` height; this maps
// that guide rectangle to pixel coordinates of the captured photo.

/** A crop rectangle in source-image pixels. */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Legacy framed-viewfinder aspect — only correct when capture runs in the 3:4 box. */
export const FRAMED_VIEW_AR = 3 / 4;
const GUIDE_WIDTH_FRACTION = 0.88; // card width as a fraction of the box (overlay GW/VB_W)

/**
 * Given the photo's pixel size, the guide `aspect` (width ÷ height), and the
 * aspect of the box the preview ACTUALLY rendered in, return the card-guide
 * crop rect in photo pixels:
 *   1. the cover-fit box shows a centred `viewAr` slice of the photo,
 *   2. the guide is centred in that slice (88% wide, `aspect` ratio).
 *
 * `viewAr` is a parameter because assuming it was the bug: this math was
 * written for the framed 3:4 viewfinder, and capture then moved to a
 * FULL-SCREEN modal (~9:19.5) without the constant following. A cover-fit
 * 3:4 slice of the photo is far wider than the slice a full-screen preview
 * shows, so every review image came back ~1.6× wider than what the user had
 * framed. The caller passes the MEASURED box aspect, so the crop and the
 * preview agree by construction.
 */
export function cardCropRect(
  imageW: number,
  imageH: number,
  aspect: number,
  viewAr: number = FRAMED_VIEW_AR,
): CropRect {
  const photoAR = imageW / imageH;
  let visW: number;
  let visH: number;
  let offX: number;
  let offY: number;
  if (photoAR > viewAr) {
    visH = imageH;
    visW = imageH * viewAr;
    offX = (imageW - visW) / 2;
    offY = 0;
  } else {
    visW = imageW;
    visH = imageW / viewAr;
    offX = 0;
    offY = (imageH - visH) / 2;
  }
  const leftFraction = (1 - GUIDE_WIDTH_FRACTION) / 2;
  // card height ÷ box height = (cardWidthFrac · boxWidth / aspect) / boxHeight,
  // and boxWidth ÷ boxHeight = viewAr.
  const heightFraction = (GUIDE_WIDTH_FRACTION * viewAr) / aspect;
  const topFraction = (1 - heightFraction) / 2;
  return {
    originX: offX + leftFraction * visW,
    originY: offY + topFraction * visH,
    width: GUIDE_WIDTH_FRACTION * visW,
    height: heightFraction * visH,
  };
}
