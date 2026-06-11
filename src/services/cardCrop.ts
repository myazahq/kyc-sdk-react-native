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

const VIEW_AR = 3 / 4; // viewfinder box width ÷ height
const GUIDE_WIDTH_FRACTION = 0.88; // card width as a fraction of the box (overlay GW/VB_W)

/**
 * Given the photo's pixel size and the guide `aspect` (width ÷ height), return
 * the card-guide crop rect in photo pixels:
 *   1. the cover-fit 3:4 box shows a centred 3:4 slice of the photo,
 *   2. the guide is centred in that slice (88% wide, `aspect` ratio).
 */
export function cardCropRect(imageW: number, imageH: number, aspect: number): CropRect {
  const photoAR = imageW / imageH;
  let visW: number;
  let visH: number;
  let offX: number;
  let offY: number;
  if (photoAR > VIEW_AR) {
    visH = imageH;
    visW = imageH * VIEW_AR;
    offX = (imageW - visW) / 2;
    offY = 0;
  } else {
    visW = imageW;
    visH = imageW / VIEW_AR;
    offX = 0;
    offY = (imageH - visH) / 2;
  }
  const leftFraction = (1 - GUIDE_WIDTH_FRACTION) / 2;
  // card height ÷ box height = (cardWidthFrac · boxWidth / aspect) / boxHeight,
  // and boxWidth ÷ boxHeight = VIEW_AR.
  const heightFraction = (GUIDE_WIDTH_FRACTION * VIEW_AR) / aspect;
  const topFraction = (1 - heightFraction) / 2;
  return {
    originX: offX + leftFraction * visW,
    originY: offY + topFraction * visH,
    width: GUIDE_WIDTH_FRACTION * visW,
    height: heightFraction * visH,
  };
}
