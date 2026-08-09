import React from 'react';
import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg';

// The card window within a 3:4 viewBox, centred. Height follows the per-ID
// guide aspect so the overlay matches the auto-crop (cropCardRegion) — a guide
// that disagrees with the crop teaches the user to frame it wrong.
const VB_W = 100;
const VB_H = 133;
const GX = 6;
const GW = 88;
const C = 7; // corner accent length

/**
 * The dimmed surround + dashed document window + primary corner accents.
 *
 * Split out of CameraViewfinder purely for the 200-line rule: it is static
 * geometry with no state, and keeping it here leaves the viewfinder itself
 * about camera wiring rather than path maths.
 */
export function CardGuide({
  guideAspect,
  primary,
}: {
  guideAspect: number;
  primary: string;
}): React.ReactElement {
  const GH = GW / guideAspect;
  const GY = (VB_H - GH) / 2;

  return (
    <Svg
      style={{ position: 'absolute', inset: 0 }}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <Mask id="cardMask">
          <Rect width={VB_W} height={VB_H} fill="white" />
          <Rect x={GX} y={GY} width={GW} height={GH} rx={3} fill="black" />
        </Mask>
      </Defs>
      <Rect width={VB_W} height={VB_H} fill="rgba(0,0,0,0.55)" mask="url(#cardMask)" />
      <Rect
        x={GX}
        y={GY}
        width={GW}
        height={GH}
        rx={3}
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={0.6}
        strokeDasharray="5 3"
      />
      <Path d={`M${GX},${GY + C} L${GX},${GY} L${GX + C},${GY}`} stroke={primary} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d={`M${GX + GW - C},${GY} L${GX + GW},${GY} L${GX + GW},${GY + C}`} stroke={primary} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d={`M${GX + GW},${GY + GH - C} L${GX + GW},${GY + GH} L${GX + GW - C},${GY + GH}`} stroke={primary} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d={`M${GX + C},${GY + GH} L${GX},${GY + GH} L${GX},${GY + GH - C}`} stroke={primary} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
