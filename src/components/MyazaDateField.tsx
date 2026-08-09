import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import {
  MONTH_NAMES,
  WEEKDAY_INITIALS,
  addMonth,
  monthMatrix,
  parseIsoDate,
  toIsoDate,
} from '../lib/calendar';
import { Icon } from './Icon';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';

/**
 * A date field that opens a REAL calendar picker, replacing the "type
 * YYYY-MM-DD" text input — nobody should hand-format an ISO date on a phone
 * keyboard. JS-drawn rather than `@react-native-community/datetimepicker`
 * because a native module would be a new install step for every SDK consumer,
 * and a JS calendar themes correctly (org palette, dark mode) for free — the
 * same reason the Flutter SDK wraps `showDatePicker` in its own theme.
 *
 * The value contract is unchanged: emits strict `YYYY-MM-DD`, exactly what the
 * text input produced and what the server validates.
 *
 * Years run NEWEST-FIRST in the year grid: the common date questions are
 * birthdays and document dates, both reached faster from the recent end.
 */
export function MyazaDateField({
  value,
  onChange,
  placeholder,
  error,
}: {
  value?: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  error?: string | null;
}): React.ReactElement {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={selected ? `Date, ${value}` : (placeholder ?? 'Select a date')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderRadius: radius.sm,
          // Mirrors MyazaInput's border grammar so the two field kinds sit
          // side by side without looking like different systems.
          borderWidth: error ? 1.5 : 1,
          borderColor: error ? colors.error : colors.border,
          backgroundColor: colors.background,
        }}
      >
        <Icon name="calendar" size={18} color={colors.textSecondary} />
        <View style={{ width: spacing.sm }} />
        <MyazaText variant="body" color={selected ? undefined : colors.textMuted} style={{ flex: 1 }}>
          {selected ? value! : (placeholder ?? 'Select a date')}
        </MyazaText>
        <Icon name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
      {error ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.xs }}>
          {error}
        </MyazaText>
      ) : null}

      {open ? (
        <DatePickerSheet
          initial={selected}
          onClose={() => setOpen(false)}
          onPick={(iso) => {
            setOpen(false);
            onChange(iso);
          }}
        />
      ) : null}
    </>
  );
}

/** Same range as the Flutter SDK's picker: 1900 through five years out. */
const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear() + 5;

function DatePickerSheet({
  initial,
  onClose,
  onPick,
}: {
  initial: ReturnType<typeof parseIsoDate>;
  onClose: () => void;
  onPick: (iso: string) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: initial?.year ?? today.getFullYear(),
    month0: initial?.month0 ?? today.getMonth(),
  });
  const [pickingYear, setPickingYear] = useState(false);

  const weeks = monthMatrix(cursor.year, cursor.month0);
  const isToday = (d: number) =>
    cursor.year === today.getFullYear() && cursor.month0 === today.getMonth() && d === today.getDate();
  const isSelected = (d: number) =>
    !!initial && initial.year === cursor.year && initial.month0 === cursor.month0 && initial.day === d;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        {/* Stop the backdrop press from closing when the card itself is tapped. */}
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
          {/* Month header: step, or tap the title to jump years. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Pressable
              onPress={() => setCursor((c) => addMonth(c.year, c.month0, -1))}
              hitSlop={8}
              accessibilityLabel="Previous month"
              style={{ padding: spacing.sm }}
            >
              <Icon name="chevron-left" size={20} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => setPickingYear((v) => !v)}
              accessibilityLabel="Choose year"
              style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}
            >
              <MyazaText variant="label">{`${MONTH_NAMES[cursor.month0]} ${cursor.year}`}</MyazaText>
              <Icon name="chevron-down" size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => setCursor((c) => addMonth(c.year, c.month0, 1))}
              hitSlop={8}
              accessibilityLabel="Next month"
              style={{ padding: spacing.sm }}
            >
              <Icon name="chevron-right" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {pickingYear ? (
            <ScrollView style={{ height: 280 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MAX_YEAR - i).map((y) => (
                  <Pressable
                    key={y}
                    onPress={() => {
                      setCursor((c) => ({ ...c, year: y }));
                      setPickingYear(false);
                    }}
                    style={{ width: '25%', paddingVertical: spacing.sm, alignItems: 'center' }}
                  >
                    <MyazaText
                      variant="body"
                      color={y === cursor.year ? colors.primary : undefined}
                      style={y === cursor.year ? { fontWeight: '600' } : undefined}
                    >
                      {String(y)}
                    </MyazaText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : (
            <>
              <View style={{ flexDirection: 'row' }}>
                {WEEKDAY_INITIALS.map((w, i) => (
                  <MyazaText
                    key={`${w}${i}`}
                    variant="bodySmall"
                    color={colors.textMuted}
                    style={{ flex: 1, textAlign: 'center' }}
                  >
                    {w}
                  </MyazaText>
                ))}
              </View>
              {weeks.map((week, wi) => (
                <View key={wi} style={{ flexDirection: 'row' }}>
                  {week.map((day, di) =>
                    day == null ? (
                      <View key={di} style={{ flex: 1, aspectRatio: 1 }} />
                    ) : (
                      <Pressable
                        key={di}
                        onPress={() => onPick(toIsoDate({ year: cursor.year, month0: cursor.month0, day }))}
                        accessibilityRole="button"
                        accessibilityLabel={`${day} ${MONTH_NAMES[cursor.month0]} ${cursor.year}`}
                        style={{
                          flex: 1,
                          aspectRatio: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: radius.full,
                          backgroundColor: isSelected(day) ? colors.primary : undefined,
                          borderWidth: isToday(day) && !isSelected(day) ? 1 : 0,
                          borderColor: colors.primary,
                        }}
                      >
                        <MyazaText
                          variant="body"
                          color={isSelected(day) ? colors.onPrimary : undefined}
                        >
                          {String(day)}
                        </MyazaText>
                      </Pressable>
                    ),
                  )}
                </View>
              ))}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
