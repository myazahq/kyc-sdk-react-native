import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

// ---------------------------------------------------------------------------
// The Myaza map pin — the same drawing as the web SDK's MapPinMarker and
// Flutter's map_pin_marker.dart, so the built-in OSM picker wears the pin the
// framed Google map already does. A 1:1 copy of the Bolt reference: head 46px,
// eye 0.31, stem 0.098 wide showing 0.41 below the head, no casings, flat body
// (no shadow on the pin itself).
//
// The GROUND DOT is the drag-state shadow: while the map pans the pin lifts
// 17px and the dot appears at the landing point beneath it; when the pin
// lands the dot goes, leaving the stem tip resting exactly on the picked
// coordinate. The parent aligns this widget's BOTTOM edge to the map centre.
// ---------------------------------------------------------------------------

export const PIN_LIFT = 17;

export function MapPinMarker({
  lifted,
  color,
}: {
  /** The map is mid-pan: the pin floats and the landing dot shows. */
  lifted: boolean;
  /** The workflow's primary colour (the whole pin wears it). */
  color: string;
}): React.ReactElement {
  return (
    <View style={{ alignItems: 'center' }} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          bottom: -2.5,
          width: 11,
          height: 5,
          borderRadius: 3,
          backgroundColor: 'rgba(7, 3, 48, 0.5)',
          opacity: lifted ? 1 : 0,
        }}
      />
      <Svg
        width={46}
        height={65}
        viewBox="0 0 46 65"
        style={{ transform: [{ translateY: lifted ? -PIN_LIFT : 0 }] }}
      >
        <Rect x={20.75} y={42} width={4.5} height={23} rx={2.25} fill={color} />
        <Circle cx={23} cy={23} r={23} fill={color} />
        <Circle cx={23} cy={23} r={7} fill="#FFFFFF" />
      </Svg>
    </View>
  );
}
