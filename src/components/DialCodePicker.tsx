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
import { FloatingSheet } from './glass/FloatingSheet';
import { DialCodeDivider, DialCodeRegionHeader, DialCodeRow } from './DialCodeRow';
import { buildDialCodeItems, dialCodeItemKey, filterDialCodeOptions, type DialCodeItem } from './dialCodeRows';

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
//
// `grouped` lists the countries under region headers (Africa first), the way
// the country-select step does — what the address-scope country control asks
// for. The list itself is built by dialCodeRows.ts.
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
  pinned,
  grouped = false,
  onPick,
  onClose,
  searchPlaceholder = 'Search country or code',
}: {
  visible: boolean;
  options: DialCodeOption[];
  selected: string;
  /**
   * The visitor's IP country. Lifted out of the alphabet to the top and
   * tagged, so a guess we made on their behalf is visible AS a guess and one
   * tap away rather than buried among two hundred others.
   */
  pinned?: string | null;
  /** Region headers between the rows (the pinned row stays on top). */
  grouped?: boolean;
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

  // Where they appear to be, lifted out of the alphabet. It stays subject to
  // the search, so typing still narrows to what was asked for rather than
  // keeping a row that does not match.
  const rows = useMemo(
    () => buildDialCodeItems(filterDialCodeOptions(options, query), pinned, grouped),
    [options, query, pinned, grouped],
  );

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
        {/* Clear air between the header row (handle + close) and the search
            field — flush against the close button they read as one control. */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          {/* Deliberately NOT autofocused: springing the keyboard the instant
              the sheet opens hides half the list before the person has even
              seen it — search is one tap away for whoever wants it. */}
          <MyazaInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            prefix={<Icon name="search" size={18} color={colors.textSecondary} />}
          />
        </View>

        <FlatList
          data={rows.items}
          keyExtractor={dialCodeItemKey}
          keyboardShouldPersistTaps="handled"
          // A hairline under the pinned row only: the alphabet below it is one
          // list, and a rule between every row is noise.
          ItemSeparatorComponent={({ leadingItem }: { leadingItem: DialCodeItem }) =>
            rows.geo != null && leadingItem.kind === 'row' && leadingItem.option.code === rows.geo.code ? (
              <DialCodeDivider />
            ) : null
          }
          ListEmptyComponent={
            <MyazaText variant="bodyMedium" style={{ padding: spacing.lg, textAlign: 'center' }}>
              No countries match your search.
            </MyazaText>
          }
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <DialCodeRegionHeader region={item.region} />
            ) : (
              <DialCodeRow
                option={item.option}
                isSelected={item.option.code === selected}
                badge={rows.geo != null && item.option.code === rows.geo.code ? 'Your location' : undefined}
                onPress={() => {
                  setQuery('');
                  onPick(item.option.code);
                }}
              />
            )
          }
        />
    </FloatingSheet>
  );
}
