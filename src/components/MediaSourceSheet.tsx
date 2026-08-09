import React, { useRef } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { Icon, type IconName } from './Icon';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';

/**
 * The SDK's own "where is the document?" sheet.
 *
 * Replaces `ActionSheetIOS` / `Alert.alert`, which were the two NATIVE
 * choosers — grey system UI with bare uppercase labels, dropped into the
 * middle of an otherwise fully branded flow. A verification flow trades on
 * looking deliberate; one stock OS dialog in the middle of it reads as a seam,
 * and on Android the three-button alert didn't even look like a chooser.
 *
 * Same presentation grammar as the SDK's other sheets (select, date picker):
 * bottom card, backdrop dismiss, org palette, one icon per option so the three
 * sources are scannable without reading.
 */
export interface MediaSourceOption {
  icon: IconName;
  label: string;
  /** One line of what picking this means — the scannable part. */
  caption: string;
  onPress: () => void;
}

export function MediaSourceSheet({
  open,
  title,
  options,
  onClose,
}: {
  open: boolean;
  title: string;
  options: MediaSourceOption[];
  onClose: () => void;
}): React.ReactElement | null {
  const { colors } = useTheme();

  // iOS: a picker (photo library / files / camera) is a view controller, and
  // UIKit REFUSES to present one while this sheet's own modal is still
  // animating its dismissal — which is precisely when a "close then run the
  // picker" handler runs. So the chosen action is parked and executed from
  // the Modal's `onDismiss`, the callback that fires only after the
  // dismissal has fully completed. That is also why the Modal stays MOUNTED
  // (`visible` instead of an early null return): unmounting skips the
  // dismiss lifecycle and onDismiss never fires. Android pickers are
  // separate activities with no such conflict, so they run immediately.
  const pendingRef = useRef<(() => void) | null>(null);
  const choose = (action: () => void): void => {
    if (Platform.OS === 'ios') {
      pendingRef.current = action;
      onClose();
      return;
    }
    onClose();
    action();
  };

  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={() => {
        const run = pendingRef.current;
        pendingRef.current = null;
        run?.();
      }}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        {/* Swallow taps on the card so only the backdrop dismisses. */}
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.md,
            paddingBottom: spacing.xl,
          }}
        >
          {/* Grab handle — the affordance that says "sheet", and therefore
              "swipe-away-able", without a close button competing with the
              options. */}
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: spacing.md,
            }}
          />

          <MyazaText variant="heading3" style={{ textAlign: 'center', marginBottom: spacing.md }}>
            {title}
          </MyazaText>

          {options.map((o, i) => (
            <Pressable
              key={o.label}
              onPress={() => choose(o.onPress)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
                marginTop: i === 0 ? 0 : spacing.xs,
              })}
            >
              {/* Tinted icon disc — the same treatment the flow's info rows
                  use, so the sheet reads as part of the SDK, not the OS. */}
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: radius.full,
                  backgroundColor: colors.primary50,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={o.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <MyazaText variant="label">{o.label}</MyazaText>
                <MyazaText variant="bodySmall" color={colors.textMuted}>
                  {o.caption}
                </MyazaText>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          ))}

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={{ paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs }}
          >
            <MyazaText variant="label" color={colors.textSecondary}>
              Cancel
            </MyazaText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
