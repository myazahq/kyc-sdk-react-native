import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { Icon } from '../components/Icon';
import { KeyPersonForm } from './KeyPersonForm';
import { isKeyPersonRowValid, type KeyPersonEntry } from '../config/keyPeople';

// ---------------------------------------------------------------------------
// The add/edit key-person sheet. The list step stays a clean stack of summary
// cards; the FORM lives here — slide-up sheet, grab handle, the five fields,
// and a pinned primary action. Editing adds a visually separated destructive
// "Remove this person" beneath the save (never beside it — HIG destructive
// separation).
//
// Keyboard handling mirrors DialCodePicker: the sheet is lifted above the keys
// and sized against the space that remains, so the focused field is never
// underneath the keyboard.
//
// Save is enabled once the draft is valid. A combined-ownership overshoot
// WARNS here but never blocks saving — the fix may live on a different
// person's %, and trapping the user inside this sheet would force them to
// discard their work to go adjust it.
// ---------------------------------------------------------------------------

export function KeyPersonSheet({
  mode,
  initial,
  uboThreshold,
  otherPctTotal,
  onSave,
  onRemove,
  onClose,
}: {
  mode: 'add' | 'edit';
  initial: KeyPersonEntry;
  uboThreshold?: number;
  /** Sum of every OTHER person's ownership % — for the combined warning. */
  otherPctTotal: number;
  onSave: (entry: KeyPersonEntry) => void;
  /** Edit mode only — removes the person and closes. */
  onRemove?: () => void;
  onClose: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [draft, setDraft] = useState<KeyPersonEntry>(initial);
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    // iOS reports 'will' events early enough to resize before the keys land;
    // Android only emits 'did'.
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(show, (e) => setKeyboard(e.endCoordinates.height));
    const hidden = Keyboard.addListener(hide, () => setKeyboard(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const available = screenHeight - keyboard;
  const maxHeight = Math.min(available * 0.92, screenHeight * 0.85);

  const draftPct = Number(draft.ownershipPct);
  const combinedTotal =
    draft.ownershipPct.trim() !== '' && Number.isFinite(draftPct)
      ? otherPctTotal + draftPct
      : otherPctTotal;
  const fmtPct = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const combinedPctError =
    combinedTotal > 100
      ? `Combined ownership would be ${fmtPct(combinedTotal)}% — over by ${fmtPct(combinedTotal - 100)}%.`
      : null;

  const canSave = isKeyPersonRowValid(draft) && draft.name.trim().length >= 2;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* Same wrapper as MyazaSelect's option sheet: a flex-end backdrop with
          the sheet inside it, so the top corners round identically. Tapping
          the backdrop dismisses; a tap inside the sheet does not. */}
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close"
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            maxHeight,
            marginBottom: keyboard,
            backgroundColor: colors.background,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            overflow: 'hidden',
          }}
        >
        <View
          style={{
            alignSelf: 'center',
            width: 36,
            height: 4,
            borderRadius: radius.full,
            backgroundColor: colors.border,
            marginTop: spacing.sm,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm + 4,
            paddingBottom: spacing.sm,
          }}
        >
          <MyazaText variant="body" style={{ flex: 1, fontWeight: '700' }}>
            {mode === 'add' ? 'Add a person' : 'Edit person'}
          </MyazaText>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="x" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
        >
          <KeyPersonForm
            entry={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            uboThreshold={uboThreshold}
            combinedPctError={combinedPctError}
          />
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.lg }}>
          <MyazaButton
            label={mode === 'add' ? 'Add person' : 'Save changes'}
            onPress={canSave ? () => onSave(draft) : undefined}
            disabled={!canSave}
          />
          {mode === 'edit' && onRemove ? (
            <Pressable
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel="Remove this person"
              style={({ pressed }) => ({
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: spacing.xs,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MyazaText variant="bodySmall" color={colors.error} style={{ fontWeight: '600' }}>
                Remove this person
              </MyazaText>
            </Pressable>
          ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
