// The Street View entrance frame's maths. A mirror of the web SDK's
// StreetViewFramer `frameFov` and the Flutter street_view_fov.dart; keep the
// three in lockstep.

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The frame the applicant captured: coordinates only, so the server fetches
 *  the image with its own key. */
export interface StreetViewFrame {
  panoId: string;
  heading: number;
  pitch: number;
  fov: number;
}

/**
 * The field of view a centred sub-frame of the viewport actually subtends.
 * The frame is entrance-sized guidance, so the STORED image must be what the
 * frame showed, not the whole panorama — otherwise "fit your gate in the
 * frame" captures a streetscape with the gate somewhere in it. Exact
 * projection maths (a perspective view is a flat plane, so a width fraction
 * maps through tan, not linearly).
 */
export function frameFov(viewportFovDeg: number, widthFraction: number): number {
  const fraction = clamp(widthFraction, 0.1, 1);
  const half = (viewportFovDeg * Math.PI) / 360;
  return (2 * Math.atan(fraction * Math.tan(half)) * 180) / Math.PI;
}

/** The frame to store for a reported view: the slice the frame subtends when
 *  both widths are known, else the whole view; fov 10..120, pitch ±90. */
export function captureStreetViewFrame(
  pov: { panoId: string; heading: number; pitch: number; viewFov: number },
  frameWidth: number,
  viewWidth: number,
): StreetViewFrame {
  const fov =
    frameWidth > 0 && viewWidth > 0
      ? clamp(frameFov(pov.viewFov, frameWidth / viewWidth), 10, 120)
      : clamp(pov.viewFov, 10, 120);
  return { panoId: pov.panoId, heading: pov.heading, pitch: clamp(pov.pitch, -90, 90), fov };
}
