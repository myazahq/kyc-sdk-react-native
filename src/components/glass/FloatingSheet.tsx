import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  View,
  type ViewStyle,
} from 'react-native';
import { spacing } from '../../config/theme';
import { displayCornerRadius } from '../../lib/screen-corners';
import { useTheme } from '../runtime';
import { GlassIconButton } from '../GlassIconButton';
import { GlassSheet } from './GlassSheet';

// ---------------------------------------------------------------------------
// FloatingSheet — the shell every bottom sheet in the SDK sits in.
//
// A floating card: detached from the screen's edges by a TIGHT gap (8px), all
// four corners rounded, a grab handle centred under a whisper of padding. The
// gap is deliberately small — the earlier float swam in margin and spent
// screen height a phone does not have, while welding it flush read as a
// different surface from the SDK's glass language. The 8px is what says
// "card above the page" without costing content room.
//
// It offers three ways out, because a sheet that can only be dismissed one way
// is a trap for whichever user does not find that way:
//   • swipe it down,
//   • the close button,
//   • tap the backdrop.
//
// Shared rather than copied into each sheet: swipe-to-dismiss is the kind of
// thing that rots when it exists in four places, and the sheets would drift
// apart on handle size, dismiss threshold and safe-area maths.
// ---------------------------------------------------------------------------

/** Detached from the screen edges by a tight, even gap. */
const FLOAT_GAP = spacing.sm;

/**
 * The float's corner radius is PRESENTATION GRAMMAR, not branding — and it is
 * computed the way Apple computes nested corners: CONCENTRIC with the display,
 * i.e. the device's own corner radius minus the gap, so the sheet's curve runs
 * parallel to the phone's. Square-cornered screens have no curve to be
 * concentric with, so they keep the share-sheet look instead. Never the
 * brand-scaled `radius` tokens: an org whose buttons are 4px square should not
 * get a squared-off bottom sheet.
 */
const screenRadius = displayCornerRadius();
const SHEET_RADIUS = screenRadius > 0 ? Math.max(screenRadius - FLOAT_GAP, 16) : 38;

/**
 * The corner curve eats into the header, so the close button's inset SCALES
 * with the radius — ~0.42·R is where the system sheet sits its own X. A fixed
 * inset that cleared 38pt corners sat ON the curve at a 16-class phone's 47.
 */
const CLOSE_INSET = Math.max(14, Math.round(SHEET_RADIUS * 0.42));

/** How far down a drag must travel before release dismisses instead of springing back. */
const DISMISS_DISTANCE = 90;
/** A flick dismisses at any distance — velocity is intent, distance is only evidence of it. */
const DISMISS_VELOCITY = 0.7;

export interface FloatingSheetProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  /** Extra bottom offset, e.g. a raised keyboard. */
  bottomOffset?: number;
  /** Caps the panel; the body owns its own scrolling. */
  maxHeight?: number;
  /** Accessible label for the close button. */
  closeLabel?: string;
  /**
   * Fires once the modal has finished going away (iOS only, from `Modal`).
   *
   * Needed by callers that must wait for THIS sheet to be gone before opening
   * another one — iOS refuses to present a second modal while the first is
   * still on screen.
   */
  onDismiss?: () => void;
}

export function FloatingSheet({
  visible,
  onClose,
  children,
  bottomOffset = 0,
  maxHeight,
  closeLabel = 'Close',
  onDismiss,
}: FloatingSheetProps): React.ReactElement {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(0)).current;

  // The PanResponder is built once, so it would otherwise close over the FIRST
  // onClose forever and stop dismissing after the parent re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // A sheet reopened after being dragged away must not still be off-screen.
  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);

  const pan = useRef(
    PanResponder.create({
      // Claim on touch START, not just on move.
      //
      // The panel is wrapped in a Pressable to swallow backdrop taps, and a
      // Pressable takes the responder the instant a finger lands. Asking only
      // on move meant that Pressable had already won and the drag never began.
      // `onStartShouldSetResponder` bubbles from the deepest view up, and this
      // header is deeper than that wrapper, so claiming here beats it — while
      // the close button, deeper still, keeps winning its own taps.
      onStartShouldSetPanResponder: () => true,
      // Kept for the case where a touch begins as something else and turns
      // into a drag. Downward only: stealing horizontal or upward gestures
      // would make the scrollable bodies below feel broken.
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      // Once the drag owns the gesture, nothing may take it mid-pull.
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        // Downward only: dragging up must not detach the sheet from its corner.
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
          Animated.timing(translateY, {
            toValue: 700,
            duration: 180,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(() => onCloseRef.current());
          return;
        }
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
    }),
  ).current;

  // A TIGHT float: detached from the edges by a whisper (8px), not welded to
  // them and not swimming in margin. The gap is what says "card above the
  // page" — any more of it and the sheet loses height it needs for content.
  const panel: ViewStyle = {
    marginHorizontal: FLOAT_GAP,
    // The CARD sits low, like the system share sheet: a tight 8px off the
    // screen edge, with the home indicator riding ON the card. Reserving the
    // whole safe-area under it left the sheet hovering mid-air. The CONTENT
    // still clears the indicator — that inset moves INSIDE the card (below).
    marginBottom: bottomOffset > 0 ? bottomOffset + FLOAT_GAP : FLOAT_GAP,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Dismiss"
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <Animated.View style={[panel, { transform: [{ translateY }] }]}>
          {/* Swallows taps so only the backdrop dismisses. */}
          <Pressable onPress={() => undefined}>
            <GlassSheet
              style={{
                // Floating card: all four corners round, not just the top
                // pair — at the SYSTEM sheet's radius, never the brand scale.
                borderRadius: SHEET_RADIUS,
                maxHeight,
                // No bottom padding, deliberately: a scrolling body runs all
                // the way to the lip and is CLIPPED by the curve — content
                // sliding under the rounded edge, the way the system does it.
                overflow: 'hidden',
              }}
            >
              {/* The drag lives on the header, NOT the whole panel: bodies here
                  scroll, and a panel-wide responder fights the list for every
                  downward swipe. */}
              <View
                {...pan.panHandlers}
                style={{
                  flexDirection: 'row',
                  // TOP, not centre. Centred, the handle sits against the
                  // tallest child, so the close button's height decided how far
                  // down the panel the grabber sat. Each now hangs off the top
                  // with its own offset, which is what puts the handle at the
                  // lip where a grabber belongs. Matches the Flutter sheet.
                  alignItems: 'flex-start',
                  // Radius-proportional (CLOSE_INSET): deep concentric corners
                  // need the button further from the edges than shallow ones.
                  paddingHorizontal: CLOSE_INSET,
                }}
              >
                <View style={{ flex: 1 }} />
                {/* Grab handle — says "draggable" without a caption. */}
                <View
                  style={{
                    width: 36,
                    height: 5,
                    borderRadius: 2.5,
                    marginTop: 8,
                    backgroundColor: colors.border,
                  }}
                />
                {/* Pushed down as well as in: the button's own box already
                    holds the icon off its edges, so set flush to the top it
                    hung off the corner instead of tucking into it. */}
                <View
                  style={{
                    flex: 1,
                    alignItems: 'flex-end',
                    marginTop: Math.min(16, Math.max(6, CLOSE_INSET - 6)),
                  }}
                >
                  <GlassIconButton
                    icon="close"
                    onPress={onClose}
                    size={32}
                    iconSize={18}
                    accessibilityLabel={closeLabel}
                  />
                </View>
              </View>
              {children}
            </GlassSheet>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
