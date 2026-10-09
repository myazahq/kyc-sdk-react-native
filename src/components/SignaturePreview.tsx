import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PREVIEW_TILE, previewFrame, strokePath, type SignatureDrawing } from '../lib/signature';

// The signature that was just kept, drawn small: dark ink on a white tile, in
// both themes, like the pad it came from. Fitted to the ink rather than to the
// pad, so a small signature in one corner still fills the tile.
//
// MIRRORS the web SDK's SignaturePreview and the Flutter one.

export function SignaturePreview({
  drawing,
  label,
}: {
  drawing: SignatureDrawing;
  label: string;
}): React.ReactElement {
  const frame = previewFrame(drawing.strokes);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{
        width: PREVIEW_TILE.width,
        height: PREVIEW_TILE.height,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D4D4D4',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      {frame ? (
        <Svg width="100%" height="100%" viewBox={frame.viewBox} preserveAspectRatio="xMidYMid meet">
          {drawing.strokes.map((stroke, i) => (
            <Path
              key={i}
              d={strokePath(stroke)}
              stroke="#111111"
              strokeWidth={frame.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
