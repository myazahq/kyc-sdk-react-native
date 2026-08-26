import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { FloatingSheet } from '../components/glass/FloatingSheet';
import { KeyPersonForm } from './KeyPersonForm';
import { isKeyPersonRowValid, type KeyPersonEntry } from '../config/keyPeople';
import type { KeyPeopleSection as SectionKey } from '../config/keyPeopleSections';
import type { KeyPersonRole } from '../types/business';

/** What the sheet calls itself, per the section that opened it. */
const ADD_TITLES: Record<SectionKey, string> = {
  ubos: 'Add a beneficial owner',
  shareholders: 'Add a shareholder',
  representatives: 'Add a representative',
};

// ---------------------------------------------------------------------------
// The add/edit key-person sheet. The list step stays a clean stack of summary
// cards; the FORM lives here — the same liquid-glass FloatingSheet every other
// picker in the SDK rides (handle, glass surface, swipe-down), so the two
// sheet kinds feel like one system. Editing adds a visually separated
// destructive "Remove this person" beneath the save (never beside it — HIG
// destructive separation).
//
// Keyboard handling mirrors DialCodePicker: the sheet is lifted above the keys
// and sized against the space that remains, so the focused field is never
// underneath the keyboard.
//
// Save is enabled once the draft is valid (including a REQUIRED email when the
// workflow demands one for the role). A combined-ownership overshoot WARNS
// here but never blocks saving — the fix may live on a different person's %,
// and trapping the user inside this sheet would force them to discard their
// work to go adjust it.
// ---------------------------------------------------------------------------

export function KeyPersonSheet({
  mode,
  section,
  corporateKyb = false,
  initial,
  uboThreshold,
  otherPctTotal,
  emailRequiredFor,
  onSave,
  onRemove,
  onClose,
}: {
  mode: 'add' | 'edit';
  /** The section whose add-tile or card opened the sheet. */
  section: SectionKey;
  /** The workflow sends corporate shareholders their own KYB application. */
  corporateKyb?: boolean;
  initial: KeyPersonEntry;
  uboThreshold?: number;
  /** Sum of every OTHER person's ownership % — for the combined warning. */
  otherPctTotal: number;
  /** Roles whose email is mandatory (they are sent a verification link). */
  emailRequiredFor?: ReadonlySet<KeyPersonRole>;
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
      ? `Combined ownership would be ${fmtPct(combinedTotal)}%, over by ${fmtPct(combinedTotal - 100)}%.`
      : null;

  const canSave =
    isKeyPersonRowValid(draft, emailRequiredFor ?? new Set()) && draft.name.trim().length >= 2;

  return (
    <FloatingSheet
      visible
      onClose={onClose}
      maxHeight={maxHeight}
      // Ride above a raised keyboard — this sheet is a form.
      bottomOffset={keyboard}
      closeLabel="Close person editor"
    >
      <MyazaText
        variant="body"
        style={{
          fontWeight: '700',
          paddingHorizontal: spacing.md,
          // Tight under the handle, the way the system sheet titles sit.
          paddingTop: spacing.xs,
          paddingBottom: spacing.sm,
        }}
      >
        {mode === 'add' ? ADD_TITLES[section] : draft.isCorporate ? 'Edit company' : 'Edit person'}
      </MyazaText>

      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
      >
        <KeyPersonForm
          entry={draft}
          section={section}
          corporateKyb={corporateKyb}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          uboThreshold={uboThreshold}
          combinedPctError={combinedPctError}
          emailRequiredFor={emailRequiredFor}
        />
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <MyazaButton
          label={mode === 'add' ? (draft.isCorporate ? 'Add company' : 'Add person') : 'Save changes'}
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
            <MyazaText variant="bodyMedium" color={colors.error} style={{ fontWeight: '600' }}>
              {draft.isCorporate ? 'Remove this company' : 'Remove this person'}
            </MyazaText>
          </Pressable>
        ) : null}
      </View>
    </FloatingSheet>
  );
}
