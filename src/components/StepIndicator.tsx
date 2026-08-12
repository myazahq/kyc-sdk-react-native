import React, { useState } from 'react';
import { PixelRatio, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { spacing } from '../config/theme';
import { fitStepCircles, windowedSteps, type StepSlot } from '../lib/step-window';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { Icon } from './Icon';

// Segmented numbered step indicator — 1:1 with the Flutter SDK's _StepIndicator.
// N numbered circles connected by thin lines:
//   • completed → filled primary + number + a check BADGE
//   • active    → filled primary + number
//   • upcoming  → outlined (primary200) + muted number
// activeIndex = round(progress * stepCount) - 1.
//
// Long flows COLLAPSE rather than overflow, but only as a LAST RESORT: the row
// measures itself and shows as many real circles as the width allows, windowing
// around the current step (first and last always shown) only once the connectors
// would stop reading as a chain. See lib/step-window.

export interface StepIndicatorProps {
  /** 0.0–1.0 progress fraction. */
  progress: number;
  stepCount: number;
}

/** Base circle size, before text scaling. */
const CIRCLE = 26;

export function StepIndicator({ progress, stepCount }: StepIndicatorProps): React.ReactElement {
  const { colors } = useTheme();
  const active = Math.round(progress * stepCount) - 1;

  // Grow the circle with the system text size, or the number inside it clips
  // the moment a user turns Dynamic Type up — the circle was a hard 26px while
  // the label scaled freely. Capped at 1.4: past that the row matters less than
  // the step content below it, and an indicator that pushes the title off screen
  // helps nobody.
  const scale = Math.min(PixelRatio.getFontScale(), 1.4);
  const size = Math.round(CIRCLE * scale);
  const badge = Math.round(13 * scale);

  // How many circles actually fit. Measured rather than assumed, so a flow
  // collapses on a narrow phone and stays whole on a wide one instead of both
  // obeying the same hardcoded cap. The window width is the first estimate — it
  // is right on the first frame, which avoids rendering a collapsed row and then
  // snapping to a full one — and onLayout corrects it if the row is inset by
  // anything this does not know about.
  const { width: screenWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const rowWidth = measured || Math.max(0, screenWidth - spacing.md * 2);
  const slots = windowedSteps(stepCount, active, fitStepCircles(rowWidth, size));

  const onLayout = (e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width - spacing.md * 2;
    // Only react to real changes (rotation, split screen). Setting state on
    // every layout pass would re-render the row for nothing.
    setMeasured((prev) => (Math.abs(prev - w) > 1 ? w : prev));
  };

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }}
      onLayout={onLayout}
      // ONE label for the whole row. Previously a screen reader walked ten
      // unlabelled circles and announced a bare "6", which says nothing about
      // how far through the flow that is.
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${Math.min(Math.max(active + 1, 1), stepCount)} of ${stepCount}`}
      accessibilityValue={{
        min: 1,
        max: stepCount,
        now: Math.min(Math.max(active + 1, 1), stepCount),
      }}
    >
      {slots.map((slot: StepSlot, position) => {
        const isEllipsis = slot === 'ellipsis';
        const completed = !isEllipsis && slot < active;
        const isActive = !isEllipsis && slot === active;
        const filled = completed || isActive;
        return (
          <React.Fragment key={isEllipsis ? `gap-${position}` : `step-${slot}`}>
            {isEllipsis ? (
              // Collapsed run. Sized to the circle's height so the connectors on
              // either side stay on the same centre line and the chain reads as
              // continuous rather than broken in two.
              <View
                style={{ height: size, justifyContent: 'center', paddingHorizontal: 2 }}
                importantForAccessibility="no"
              >
                <MyazaText
                  variant="bodySmall"
                  color={colors.textMuted}
                  style={{ fontSize: 13, letterSpacing: 1 }}
                  allowFontScaling={false}
                >
                  ···
                </MyazaText>
              </View>
            ) : (
              // Positioning context for the badge, which straddles the circle's
              // edge. Nothing here clips, so the overhang renders.
              <View style={{ width: size, height: size }} importantForAccessibility="no">
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: filled ? colors.primary : 'transparent',
                    borderWidth: 1.5,
                    borderColor: filled ? colors.primary : colors.primary200,
                  }}
                >
                  {/* The NUMBER stays, completed or not. A check alone says a
                      step is done but not WHICH step — and once the row is
                      windowed ("1 ··· 5 6 7 ··· 10") that is precisely what the
                      numbers are there to answer. */}
                  <MyazaText
                    variant="bodySmall"
                    color={filled ? '#FFFFFF' : colors.textMuted}
                    style={{ fontSize: 12, fontWeight: '700' }}
                    // The circle already scales with the system text size, so
                    // scaling the glyph again would overflow it.
                    allowFontScaling={false}
                  >
                    {slot + 1}
                  </MyazaText>
                </View>

                {/* Completion rides as a badge tucked onto the circle's corner.
                    The ring is WHITE — the same colour as the number inside the
                    circle — because the badge sits on the circle, not on the
                    page. Ringing it in the page background (which the chip
                    portrait's CheckBadge does, correctly, because it sits on a
                    photo) painted a near-black blob around the check on the dark
                    theme, where background is #040218. */}
                {completed ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -2,
                      width: badge,
                      height: badge,
                      borderRadius: badge / 2,
                      backgroundColor: colors.success,
                      // 1px, not 1.5: on a 13px badge a 1.5px ring eats nearly a
                      // quarter of the diameter and reads as a white outline
                      // rather than a hairline separating badge from circle.
                      borderWidth: 1,
                      borderColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="check" size={Math.round(badge * 0.6)} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
            )}
            {position < slots.length - 1 ? (
              <View
                style={{
                  flex: 1,
                  // Floor, so an unforeseen overflow degrades to a visibly short
                  // connector rather than a row of circles with no chain at all.
                  minWidth: 6,
                  height: 2,
                  // UNIFORM, deliberately: fitStepCircles budgets 3+3 per
                  // connector, so widening this for completed steps made the row
                  // need more space than was reserved. The badge is tucked in
                  // far enough (right: -2) not to need the extra.
                  marginHorizontal: 3,
                  borderRadius: 1,
                  backgroundColor: completed ? colors.primary : colors.primary200,
                }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}
