import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { IMMERSIVE_CONTROLS_BAND, useSheetInsets } from '../../components/sheetInsets';
import { windowRect, type Rect, type Size, aboveHeight } from '../../lib/livenessCutout';

// ---------------------------------------------------------------------------
// The full-screen liveness camera's layout (see lib/livenessCutout).
//
// Everything is placed from the box this view is MEASURED at, and that same
// box is reported up (`onSize`) so the face is judged against the window that
// is actually on screen.
//
//   backdrop  what fills the box: the camera, sharp in the window and blurred
//             around it, or the photo blurred
//   cutout    what is drawn over the window: its line and its marks, or the
//             photo on the review
//   above     the instruction, resting just above the window, and over it
//             whatever is narrow enough to stand BETWEEN the back and close
//             buttons (the gesture picture)
//   below     what starts just under it: the step count
//   footer    what rests on the bottom edge
// ---------------------------------------------------------------------------

/** The gap the sheet leaves over its back and close buttons (VerificationSheet). */
const CONTROLS_TOP_GAP = 8;

export function ImmersiveFrame({
  backdrop,
  cutout,
  above,
  below,
  footer,
  footerReserve = 32,
  onSize,
}: {
  /** Given the measured box and where the window sits in it (null until
   *  measured), so the blur can leave exactly the window out. */
  backdrop: (frame: Size, window: Rect | null) => React.ReactNode;
  /** Given the window and the box it sits in, so the review can lay its photo
   *  out as the camera was: across the whole box, seen through the window. */
  cutout: (window: Rect, frame: Size) => React.ReactNode;
  /** Given the height there is under the back and close buttons (`room`),
   *  and the height up to the top of those buttons (`reach`): what is wide
   *  keeps to the first, what is narrow and centred may use the second. */
  above: (room: number, reach: number) => React.ReactNode;
  below?: React.ReactNode;
  footer?: React.ReactNode;
  /** The height `footer` needs, kept clear of `below`. */
  footerReserve?: number;
  onSize?: (size: Size) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const insets = useSheetInsets();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const laidOut = size.width > 0 && size.height > 0;
  const window = windowRect(size, insets.top);
  const windowTop = window.y;
  const windowBottom = windowTop + window.height;
  // The block starts level with the top of the buttons, not under them: the
  // buttons sit at the sides, and the middle of that band is free.
  const aboveTop = insets.top + CONTROLS_TOP_GAP;
  const underControls = IMMERSIVE_CONTROLS_BAND - CONTROLS_TOP_GAP;
  const room = Math.max(0, windowTop - 20 - insets.top - IMMERSIVE_CONTROLS_BAND);
  const reach = Math.max(0, windowTop - 20 - aboveTop);

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background, overflow: 'hidden' }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width === size.width && height === size.height) return;
        setSize({ width, height });
        onSize?.({ width, height });
      }}
    >
      {backdrop(size, laidOut ? window : null)}
      {laidOut ? (
        <>
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: window.x,
              top: windowTop,
              width: window.width,
              height: window.height,
            }}
          >
            {cutout(window, size)}
          </View>
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: spacing.lg,
              right: spacing.lg,
              top: aboveTop,
              // On a very short phone the words keep their height under the
              // buttons and run over the window's top edge instead.
              height: aboveHeight(room) + underControls,
              justifyContent: 'flex-end',
              // Very large text is cut at the top rather than sliding off the
              // sheet.
              overflow: 'hidden',
            }}
          >
            {above(room, reach)}
          </View>
          {below ? (
            <ScrollView
              style={{
                position: 'absolute',
                left: spacing.lg,
                right: spacing.lg,
                top: windowBottom + 24,
                bottom: insets.bottom + (footer ? footerReserve + 24 : 12),
              }}
              contentContainerStyle={{ flexGrow: 0 }}
              keyboardShouldPersistTaps="handled"
            >
              {below}
            </ScrollView>
          ) : null}
          {footer ? (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: spacing.lg,
                right: spacing.lg,
                bottom: insets.bottom + 12,
                alignItems: 'center',
              }}
            >
              {footer}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
