import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

// ─── A dashed card border the platform cannot restyle ─────────────────────────
//
// Native `borderStyle: 'dashed'` is drawn by the OS, and iOS draws it with
// long dashes and wide gaps that nothing can tune — beside the web SDK's
// tight CSS pattern the same card looked hand-drawn. This draws the same
// rectangle with SVG, where the dash pattern is ours to set; the defaults
// match the web look (and the Flutter SDK's DashedRoundedBorder). Overlay it
// inside a relatively-positioned card and drop the native border props.

export function DashedBorder({
  color,
  radius,
  strokeWidth = 2,
  dash = 4,
  gap = 3,
}: {
  color: string;
  radius: number;
  strokeWidth?: number;
  dash?: number;
  gap?: number;
}): React.ReactElement {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {size && size.w > strokeWidth && size.h > strokeWidth ? (
        <Svg width={size.w} height={size.h}>
          {/* Inset by half the stroke so the line sits fully inside the card,
              where a native border would have been. */}
          <Rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={size.w - strokeWidth}
            height={size.h - strokeWidth}
            rx={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={[dash, gap]}
          />
        </Svg>
      ) : null}
    </View>
  );
}
