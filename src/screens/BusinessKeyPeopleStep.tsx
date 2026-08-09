import React, { useState } from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { KeyPersonCard } from './KeyPersonCard';
import { KeyPersonSheet } from './KeyPersonSheet';
import { keyPeopleMinEntries } from '../config/businessSteps';
import {
  emptyKeyPerson,
  invalidKeyPersonRows,
  isKeyPersonRowBlank,
  isKeyPersonRowValid,
  MAX_KEY_PEOPLE_ROWS,
  type KeyPersonEntry,
} from '../config/keyPeople';
import type { KeyPersonRole } from '../types/business';

// ---------------------------------------------------------------------------
// Applicant-declared directors, owners and signatories.
//
// The registry lookup discovers people too, and the server reconciles the two:
// someone the registry names who the applicant did NOT list is flagged
// `undisclosed`, which is a risk signal in its own right. So this screen is not
// merely data entry — what the applicant chooses to omit is evidence.
//
// The list stays a clean stack of compact summary cards; the FORM lives in the
// add/edit sheet (KeyPersonSheet). Tapping a card edits it; "Add a person"
// opens a fresh sheet. Removal is inside the edit sheet, behind a deliberate
// tap — never one stray touch on the list.
// ---------------------------------------------------------------------------

export const businessKeyPeopleMeta = {
  title: 'Directors & owners',
  description:
    "List the company's directors and owners of 25% or more. Each will receive a link to verify their identity.",
};

type SheetState = { mode: 'add' } | { mode: 'edit'; index: number } | null;

export function BusinessKeyPeopleStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const { colors } = useTheme();
  const rows = useKyc((s) => s.businessApplication.keyPeople);
  const registryCountry = useKyc((s) => s.business.country);
  const [sheet, setSheet] = useState<SheetState>(null);

  const minEntries = keyPeopleMinEntries(config.business);
  const validCount = rows.filter(isKeyPersonRowValid).length;
  const invalidRows = invalidKeyPersonRows(rows);
  const uboThreshold = config.business?.keyPeople?.ownershipThreshold ?? 25;

  // Combined ownership above 100% is factually impossible — catch the typo
  // here rather than shipping it into the registry cross-check as a doomed
  // mismatch. Under 100% is fine (not every owner has to be listed).
  const pctOf = (row: KeyPersonEntry): number => {
    const n = Number(row.ownershipPct);
    return row.ownershipPct.trim() !== '' && Number.isFinite(n) ? n : 0;
  };
  const totalPct = rows.reduce((sum, row) => sum + pctOf(row), 0);
  const overAllocated = totalPct > 100;
  const fmtPct = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  const canContinue = validCount >= minEntries && invalidRows.length === 0 && !overAllocated;

  // New people default to the business's registry country (picked on the
  // details step) — most directors are local, and a foreign one just switches
  // theirs. Mirrors the web and Flutter SDKs.
  const defaultCountry = registryCountry ?? config.business?.country ?? '';

  const commit = (next: KeyPersonEntry[]): void => store.getState().setKeyPeople(next);
  const handleSave = (entry: KeyPersonEntry): void => {
    if (sheet?.mode === 'edit') {
      commit(rows.map((row, i) => (i === sheet.index ? entry : row)));
    } else {
      commit([...rows, entry]);
    }
    setSheet(null);
  };
  const handleRemove = (): void => {
    if (sheet?.mode === 'edit') commit(rows.filter((_, i) => i !== sheet.index));
    setSheet(null);
  };

  // Indexed access may be undefined under strict indexing — resolved once here
  // so the sheet only ever mounts with a real entry.
  const editEntry = sheet?.mode === 'edit' ? rows[sheet.index] : undefined;

  const handleContinue = (): void => {
    if (!canContinue) return;
    // Half-typed rows are dropped rather than submitted: an entry the user
    // abandoned is not a person they disclosed.
    commit(rows.filter(isKeyPersonRowValid));
    store.getState().nextStep();
  };

  // The dashed hint boxes and their copy mirror the web SDK's step 1:1.
  const hint =
    rows.length === 0 && minEntries === 0
      ? "You can skip this if you're unsure — we'll identify directors and owners from the official registry. Adding them here speeds up the review."
      : minEntries > 0 && validCount < minEntries
        ? `List at least ${minEntries} ${minEntries === 1 ? 'person' : 'people'} to continue${
            validCount > 0 ? ` (${validCount} of ${minEntries} added)` : ''
          }.`
        : null;

  return (
    <View>
      {hint ? (
        <View
          style={{
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            borderRadius: radius.sm,
            backgroundColor: colors.backgroundSecondary,
            padding: spacing.md,
            marginBottom: spacing.md,
          }}
        >
          <MyazaText variant="bodySmall" color={colors.textSecondary}>
            {hint}
          </MyazaText>
        </View>
      ) : null}

      {rows.map((row, index) =>
        isKeyPersonRowBlank(row) ? null : (
          <KeyPersonCard key={index} entry={row} onPress={() => setSheet({ mode: 'edit', index })} />
        ),
      )}
      {/* The cards and the add affordance are different things — give the
          boundary some air (cards already carry a small bottom margin). */}
      {rows.some((row) => !isKeyPersonRowBlank(row)) ? (
        <View style={{ height: spacing.sm }} />
      ) : null}

      {rows.length < MAX_KEY_PEOPLE_ROWS ? (
        <MyazaButton
          label="Add a person"
          variant="outline"
          leadingIcon="user-plus"
          onPress={() => setSheet({ mode: 'add' })}
        />
      ) : (
        <MyazaText variant="bodySmall" color={colors.textMuted} style={{ textAlign: 'center' }}>
          {`You can list up to ${MAX_KEY_PEOPLE_ROWS} people here.`}
        </MyazaText>
      )}
      {/* Breathing room between the add-person affordance and the summary bar —
          matches the Flutter screen's SizedBox after its outline button. */}
      <View style={{ height: spacing.md }} />

      {/* Total-ownership summary at the DECISION point — the disabled Continue
          button always explains itself, wherever the offending card is. */}
      {totalPct > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: overAllocated ? colors.errorBg : colors.backgroundSecondary,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 4,
          }}
        >
          <MyazaText variant="bodySmall" color={overAllocated ? colors.error : colors.textMuted}>
            Total ownership listed
          </MyazaText>
          <MyazaText
            variant="bodySmall"
            color={overAllocated ? colors.error : colors.textDark}
            style={{ fontWeight: '700' }}
          >
            {`${fmtPct(totalPct)}%`}
          </MyazaText>
        </View>
      ) : null}
      {overAllocated ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.xs }}>
          {`Together the percentages can't exceed 100% — reduce them by ${fmtPct(totalPct - 100)}%.`}
        </MyazaText>
      ) : null}

      <View style={{ height: spacing.md }} />
      <MyazaButton label="Continue" onPress={handleContinue} disabled={!canContinue} />

      {sheet && (sheet.mode === 'add' || editEntry) ? (
        <KeyPersonSheet
          mode={sheet.mode}
          initial={editEntry ?? { ...emptyKeyPerson(), country: defaultCountry }}
          uboThreshold={uboThreshold}
          otherPctTotal={editEntry ? totalPct - pctOf(editEntry) : totalPct}
          onSave={handleSave}
          onRemove={sheet.mode === 'edit' ? handleRemove : undefined}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

export type { KeyPersonRole };
