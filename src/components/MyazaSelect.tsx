import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { useInputFontFamily } from './fonts';
import { MyazaText } from './Typography';
import { Icon } from './Icon';

// ---------------------------------------------------------------------------
// The select field — a collapsed value that opens a sheet of options.
//
// The counterpart to OptionRow, not a replacement: OptionRow lays every choice
// out because the choices ARE the information (which ID type, which country).
// A select is for the case where the field is a detail on a form full of other
// fields — the proof-of-address document kind sits above an upload zone, and
// four stacked cards there push the actual task off the screen.
//
// Mirrors the Flutter SDK's MyazaSelect so the two platforms present the same
// control for the same job.
// ---------------------------------------------------------------------------

export interface MyazaSelectOption<T> {
  value: T;
  label: string;
  /** Something before the label — a flag, an icon. */
  leading?: React.ReactNode;
  /**
   * Secondary line under the label, shown in the SHEET only — the collapsed
   * field stays as short as its label. Currency codes need it: "GHS" and
   * "GMD" are one letter apart and mean different money.
   */
  description?: string;
}

export function MyazaSelect<T extends string | number>({
  value,
  options,
  onChange,
  hint = 'Select an option',
  sheetTitle,
  enabled = true,
  height,
  compact = false,
  searchable = false,
}: {
  value: T | null | undefined;
  options: Array<MyazaSelectOption<T>>;
  onChange: (value: T) => void;
  /** Shown when nothing is selected yet. */
  hint?: string;
  /** Sheet header; falls back to `hint`. */
  sheetTitle?: string;
  enabled?: boolean;
  /**
   * Fixes the field's height. Needed when the select sits beside another
   * control (the questionnaire's currency next to its amount) — vertical
   * padding alone leaves the two boxes different heights.
   */
  height?: number;
  /**
   * Shrink to the width of the value instead of filling the row — the inline
   * variant (the questionnaire's currency beside its amount). Without it the
   * label competes for a fixed width and a code like "NGN" gets ellipsised to
   * "N…". Mirrors the Flutter SDK's `compact`.
   */
  compact?: boolean;
  /**
   * Pin a search field to the top of the sheet, filtering options by label —
   * for lists too long to scroll (the every-ISO-country selects). Mirrors the
   * Flutter SDK's `searchable`.
   */
  searchable?: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  // TextInput does not inherit fontFamily in RN — set it or the search field
  // (and its placeholder) renders in the system face.
  const fontFamily = useInputFontFamily();
  const { height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value) ?? null;
  const normalized = query.trim().toLowerCase();
  const visible =
    searchable && normalized !== ''
      ? options.filter((o) => o.label.toLowerCase().includes(normalized))
      : options;

  return (
    <>
      <Pressable
        onPress={() => {
          if (enabled && options.length > 0) setOpen(true);
        }}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !enabled, expanded: open }}
        accessibilityLabel={selected?.label ?? hint}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          // A fixed height wins over padding when the field has to line up
          // with a neighbouring input.
          ...(height == null ? { paddingVertical: spacing.md } : { height }),
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: enabled ? colors.background : colors.backgroundSecondary,
          opacity: enabled ? 1 : 0.6,
          ...(compact ? { alignSelf: 'flex-start' as const } : null),
        }}
      >
        {selected?.leading ? (
          <>
            {selected.leading}
            <View style={{ width: spacing.sm }} />
          </>
        ) : null}
        <MyazaText
          variant="body"
          color={selected ? undefined : colors.textMuted}
          // Compact sizes to its content, so the value is never ellipsised.
          style={compact ? undefined : { flex: 1 }}
          numberOfLines={1}
        >
          {selected?.label ?? hint}
        </MyazaText>
        <View style={{ width: spacing.sm }} />
        <Icon name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setOpen(false);
          setQuery('');
        }}
      >
        {/* Tapping the backdrop dismisses, matching the platform sheet. */}
        <Pressable
          onPress={() => {
            setOpen(false);
            setQuery('');
          }}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        >
          {/* Stops a tap inside the sheet from closing it. */}
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingBottom: spacing.lg,
              // Long option lists stay inside the sheet and scroll.
              maxHeight: windowHeight * 0.6,
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
            <MyazaText
              variant="body"
              style={{
                fontWeight: '700',
                paddingHorizontal: spacing.md,
                paddingTop: spacing.md,
                paddingBottom: spacing.sm,
              }}
            >
              {sheetTitle ?? hint}
            </MyazaText>

            {searchable ? (
              // Pinned above the list, so it stays put while results scroll.
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginHorizontal: spacing.md,
                  marginBottom: spacing.sm,
                  paddingHorizontal: spacing.sm + 4,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                  backgroundColor: colors.backgroundSecondary,
                }}
              >
                <Icon name="search" size={16} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search"
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm + 2,
                    paddingHorizontal: spacing.sm,
                    color: colors.textDark,
                    fontSize: 15,
                    fontFamily,
                  }}
                />
                {query !== '' ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                    <Icon name="x" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
              {visible.length === 0 ? (
                <MyazaText
                  variant="bodySmall"
                  color={colors.textMuted}
                  style={{ padding: spacing.md, textAlign: 'center' }}
                >
                  No matches
                </MyazaText>
              ) : null}
              {visible.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={String(option.value)}
                    onPress={() => {
                      setOpen(false);
                      setQuery('');
                      if (!isSelected) onChange(option.value);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.md,
                    }}
                  >
                    {option.leading ? (
                      <>
                        {option.leading}
                        <View style={{ width: spacing.sm }} />
                      </>
                    ) : null}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <MyazaText
                        variant="body"
                        color={isSelected ? colors.primary : undefined}
                        style={{ fontWeight: isSelected ? '600' : '400' }}
                      >
                        {option.label}
                      </MyazaText>
                      {option.description ? (
                        <MyazaText
                          variant="bodySmall"
                          color={colors.textSecondary}
                          numberOfLines={1}
                        >
                          {option.description}
                        </MyazaText>
                      ) : null}
                    </View>
                    {isSelected ? <Icon name="check" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
