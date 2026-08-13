import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { MyazaInput } from './MyazaInput';
import { Icon } from './Icon';
import { CountryFlag } from './CountryFlag';
import { FloatingSheet } from './glass/FloatingSheet';

// ---------------------------------------------------------------------------
// THE country sheet — the phone field's dial-code picker, generalised.
//
// A dedicated searchable sheet rather than MyazaSelect: that control renders
// every option in a ScrollView, which is fine for four document kinds and
// unusable for ~240 countries. A FlatList keeps the list smooth on a low-end
// Android device. `dialCode` is optional: with it this is the phone picker,
// without it a plain country picker (the key-people "where their ID was
// issued" field) — SAME sheet, SAME search, so the two feel identical.
//
// Laid out to match Flutter's showDialCodePicker row for row: a MyazaInput with
// a search prefix on top, then flag / full country name / dial code, with the
// selected row tinted rather than ticked.
//
// The sheet is sized against the space left ABOVE the keyboard, like Flutter's.
// The search field autofocuses, so measuring against the full screen would put
// every result underneath the keys the moment the user started typing.
// ---------------------------------------------------------------------------

export interface DialCodeOption {
  code: string;
  name: string;
  /** Absent ⇒ a plain country picker: no trailing code, name/ISO search only. */
  dialCode?: string;
}

export function DialCodePicker({
  visible,
  options,
  selected,
  onPick,
  onClose,
  searchPlaceholder = 'Search country or code',
}: {
  visible: boolean;
  options: DialCodeOption[];
  selected: string;
  onPick: (code: string) => void;
  onClose: () => void;
  searchPlaceholder?: string;
}): React.ReactElement {
  const { colors } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [query, setQuery] = useState('');
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
  const maxHeight = Math.min(Math.max(available * 0.85, 240), screenHeight * 0.6);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Match the name, the ISO code, or the dial code with or without its '+',
    // because people search for "+234", "234" and "Nigeria" in equal measure.
    const bare = q.replace(/^\+/, '');
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase() === q ||
        (o.dialCode != null && o.dialCode.replace(/^\+/, '').startsWith(bare)),
    );
  }, [options, query]);

  const close = (): void => {
    setQuery('');
    onClose();
  };

  return (
    <FloatingSheet
      visible={visible}
      onClose={close}
      maxHeight={maxHeight}
      // Ride above a raised keyboard — this sheet's whole job is a search box.
      bottomOffset={keyboard}
      closeLabel="Close country picker"
    >
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
          <MyazaInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            autoFocus
            prefix={<Icon name="search" size={18} color={colors.textSecondary} />}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(o) => o.code}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <MyazaText variant="bodyMedium" style={{ padding: spacing.lg, textAlign: 'center' }}>
              No countries match your search.
            </MyazaText>
          }
          renderItem={({ item }) => (
            <CountryRow
              option={item}
              isSelected={item.code === selected}
              onPress={() => {
                setQuery('');
                onPick(item.code);
              }}
            />
          )}
        />
    </FloatingSheet>
  );
}

function CountryRow({
  option,
  isSelected,
  onPress,
}: {
  option: DialCodeOption;
  isSelected: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: isSelected ? colors.primary50 : 'transparent',
      }}
    >
      <CountryFlag country={option.code} size={24} />
      <View style={{ width: spacing.md }} />
      {/* No line clamp: "Bosnia & Herzegovina" and the like must read in full,
          which is what Flutter's Expanded(Text) gives. */}
      <MyazaText variant="bodyMedium" style={{ flex: 1 }}>
        {option.name}
      </MyazaText>
      {option.dialCode != null ? (
        <MyazaText variant="label" color={colors.textSecondary}>
          {option.dialCode}
        </MyazaText>
      ) : null}
    </Pressable>
  );
}
