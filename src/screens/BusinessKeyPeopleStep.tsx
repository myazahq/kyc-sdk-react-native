import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { BusinessKeyPersonRow } from './BusinessKeyPersonRow';
import { keyPeopleMinEntries } from '../config/businessSteps';
import {
  emptyKeyPerson,
  invalidKeyPersonRows,
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
// Layout, copy and per-row design mirror the web SDK's BusinessKeyPeopleStep
// (and Flutter's screen) 1:1 — the description lives in the step HEADER, the
// hints are dashed cards, and each person is a bordered card with selects.
// ---------------------------------------------------------------------------

export const businessKeyPeopleMeta = {
  title: 'Directors & owners',
  description:
    "List the company's directors and owners of 25% or more. Each will receive a link to verify their identity.",
};

export function BusinessKeyPeopleStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const { colors } = useTheme();
  const rows = useKyc((s) => s.businessApplication.keyPeople);
  const registryCountry = useKyc((s) => s.business.country);

  const minEntries = keyPeopleMinEntries(config.business);
  const validCount = rows.filter(isKeyPersonRowValid).length;
  const invalidRows = invalidKeyPersonRows(rows);

  // Combined ownership above 100% is factually impossible — catch the typo
  // here rather than shipping it into the registry cross-check as a doomed
  // mismatch. Under 100% is fine (not every owner has to be listed).
  const totalPct = rows.reduce((sum, row) => {
    const n = Number(row.ownershipPct);
    return row.ownershipPct.trim() !== '' && Number.isFinite(n) ? sum + n : sum;
  }, 0);
  const overAllocated = totalPct > 100;

  const canContinue = validCount >= minEntries && invalidRows.length === 0 && !overAllocated;

  const update = (index: number, patch: Partial<KeyPersonEntry>): void => {
    store.getState().setKeyPeople(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  // New rows default to the business's registry country (picked on the
  // details step) — most directors are local, and a foreign one just switches
  // theirs. Mirrors the web and Flutter SDKs.
  const defaultCountry = registryCountry ?? config.business?.country ?? '';
  const add = (): void =>
    store.getState().setKeyPeople([...rows, { ...emptyKeyPerson(), country: defaultCountry }]);
  const remove = (index: number): void =>
    store.getState().setKeyPeople(rows.filter((_, i) => i !== index));

  const handleContinue = (): void => {
    if (!canContinue) return;
    // Half-typed rows are dropped rather than submitted: an entry the user
    // abandoned is not a person they disclosed.
    store.getState().setKeyPeople(rows.filter(isKeyPersonRowValid));
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
          }}
        >
          <MyazaText variant="bodySmall" color={colors.textSecondary}>
            {hint}
          </MyazaText>
        </View>
      ) : null}
      {overAllocated ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: `${colors.error}4D`,
            borderRadius: radius.sm,
            backgroundColor: colors.errorBg,
            padding: spacing.md,
            marginTop: hint ? spacing.sm : 0,
          }}
        >
          <MyazaText variant="bodySmall" color={colors.error}>
            {`The ownership percentages add up to ${totalPct}% — together they can't exceed 100%.`}
          </MyazaText>
        </View>
      ) : null}

      {rows.map((row, index) => (
        <BusinessKeyPersonRow
          key={index}
          row={row}
          index={index}
          onChange={(patch) => update(index, patch)}
          onRemove={() => remove(index)}
          uboThreshold={config.business?.keyPeople?.ownershipThreshold}
        />
      ))}

      <View style={{ height: spacing.md }} />
      {rows.length < MAX_KEY_PEOPLE_ROWS ? (
        <MyazaButton label="Add a person" variant="outline" leadingIcon="user-plus" onPress={add} />
      ) : (
        <MyazaText variant="bodySmall" color={colors.textMuted} style={{ textAlign: 'center' }}>
          {`You can list up to ${MAX_KEY_PEOPLE_ROWS} people here.`}
        </MyazaText>
      )}

      <View style={{ height: spacing.sm }} />
      <MyazaButton label="Continue" onPress={handleContinue} disabled={!canContinue} />
    </View>
  );
}

export type { KeyPersonRole };
