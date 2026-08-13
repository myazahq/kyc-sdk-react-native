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
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../runtime';
import { GlassIconButton } from '../GlassIconButton';
import { GlassSheet } from './GlassSheet';

// ---------------------------------------------------------------------------
// FloatingSheet — the shell every bottom sheet in the SDK sits in.
//
// It floats: inset from all three edges and rounded on every corner, rather
// than welded to the bottom of the screen. That is what the glass is for. A
// panel flush to the edge reads as part of the screen, so seeing through it
// says nothing; a detached one reads as a layer that has risen above the flow.
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

  // Read once at module init like the rest of the SDK: these sheets are modal,
  // so there is no provider above them to read live insets from.
  const safeBottom = initialWindowMetrics?.insets?.bottom ?? 0;

  const panel: ViewStyle = {
    marginHorizontal: spacing.md,
    // Clear the home indicator, and never sit flush even where there is none.
    marginBottom: bottomOffset + Math.max(safeBottom, spacing.md),
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
            <GlassSheet style={{ borderRadius: radius.xl, maxHeight, overflow: 'hidden' }}>
              {/* The drag lives on the header, NOT the whole panel: bodies here
                  scroll, and a panel-wide responder fights the list for every
                  downward swipe. */}
              <View
                {...pan.panHandlers}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingTop: spacing.sm,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <View style={{ flex: 1 }} />
                {/* Grab handle — says "draggable" without a caption. */}
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.border,
                  }}
                />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
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
