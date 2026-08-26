import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { DashedBorder } from '../components/DashedBorder';
import { KeyPeopleSectionsList } from './KeyPeopleSectionsList';
import { KeyPersonSheet } from './KeyPersonSheet';
import { keyPeopleMinEntries } from '../config/businessSteps';
import {
  keyPeopleRequireEmail,
  emptyKeyPerson,
  invalidKeyPersonRows,
  isKeyPersonRowValid,
  MAX_KEY_PEOPLE_ROWS,
  type KeyPersonEntry,
} from '../config/keyPeople';
import { SECTION_ROLE, type KeyPeopleSection as SectionKey } from '../config/keyPeopleSections';
import { defaultUboThreshold, keyPeopleSectionList } from '../config/keyPeopleSectionDefs';
import { prefillKeyPeople, shouldPrefill } from '../config/keyPeoplePrefill';
import { radius } from '../config/theme';

// ---------------------------------------------------------------------------
// The key-people step, sectioned: Beneficial owners / Shareholders /
// Directors & representatives, each with a plain-language definition, its own
// add-tile, and quick-add chips that grant a person already entered another
// hat. The sections are VIEWS over one shared list (keyPeopleSections.ts):
// one human can hold several roles, exactly as the register files them, and
// a stake at the threshold moves them up on screen exactly as the server
// will escalate them at submit.
//
// The registry lookup discovers people too, and the server reconciles the
// two: someone the registry names who the applicant did NOT list is flagged
// `undisclosed` — what the applicant chooses to omit is evidence.
// ---------------------------------------------------------------------------

export const businessKeyPeopleMeta = {
  title: 'Key people',
  description: "Add the company's directors, shareholders and beneficial owners.",
};

type SheetState = { mode: 'add' | 'edit'; section: SectionKey; index?: number } | null;

export function BusinessKeyPeopleStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const { colors } = useTheme();
  const rows = useKyc((s) => s.businessApplication.keyPeople);
  const uboUnidentifiable = useKyc((s) => s.businessApplication.uboUnidentifiable);
  const registryCountry = useKyc((s) => s.business.country);
  const officers = useKyc((s) => s.businessCheck.officers);
  const [sheet, setSheet] = useState<SheetState>(null);

  // Start from the register's own officer list (fetched by the paid check at
  // selection), so this is a confirmation rather than a memory test. Once
  // only, and never over anything typed: an applicant who has already entered
  // a name has told us something the register did not.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || officers.length === 0 || !shouldPrefill(rows)) return;
    prefilled.current = true;
    store.getState().setKeyPeople(prefillKeyPeople(officers, registryCountry ?? ''));
    // rows is deliberately out of the dep list: this must run on the arrival
    // of officers, not on every edit the applicant then makes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officers, registryCountry]);

  const minEntries = keyPeopleMinEntries(config.business);
  // Roles whose email is mandatory (the ones actually sent a verification
  // link) — threaded into every validity read so the card, the sheet and the
  // Continue gate agree on what "complete" means.
  const emailRequiredFor = useMemo(
    () => keyPeopleRequireEmail(config.business),
    [config.business],
  );
  const validCount = rows.filter((r) => isKeyPersonRowValid(r, emailRequiredFor)).length;
  const invalidRows = invalidKeyPersonRows(rows, emailRequiredFor);
  // The same line the server draws: the workflow's own threshold, else the
  // register's default (NG files significant control from a lower bar).
  const threshold =
    config.business?.keyPeople?.ownershipThreshold ??
    defaultUboThreshold(registryCountry || config.business?.country);

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
  const canAdd = rows.length < MAX_KEY_PEOPLE_ROWS;

  // New people default to the business's registry country (picked on the
  // details step) — most directors are local, and a foreign one just switches
  // theirs. Mirrors the web and Flutter SDKs.
  const defaultCountry = registryCountry ?? config.business?.country ?? '';
  const sections = keyPeopleSectionList(config.business, threshold);

  const commit = (next: KeyPersonEntry[]): void => store.getState().setKeyPeople(next);
  const handleSave = (entry: KeyPersonEntry): void => {
    if (sheet?.mode === 'edit' && sheet.index != null) {
      commit(rows.map((row, i) => (i === sheet.index ? entry : row)));
    } else {
      commit([...rows, entry]);
    }
    setSheet(null);
  };
  const handleRemove = (): void => {
    if (sheet?.mode === 'edit' && sheet.index != null) {
      commit(rows.filter((_, i) => i !== sheet.index));
    }
    setSheet(null);
  };

  // Indexed access may be undefined under strict indexing — resolved once
  // here so the sheet only ever mounts with a real entry.
  const editEntry = sheet?.mode === 'edit' && sheet.index != null ? rows[sheet.index] : undefined;

  const handleContinue = (): void => {
    if (!canContinue) return;
    // Half-typed rows are dropped rather than submitted: an entry the user
    // abandoned is not a person they disclosed.
    commit(rows.filter((r) => isKeyPersonRowValid(r, emailRequiredFor)));
    store.getState().nextStep();
  };

  // The dashed hint boxes and their copy mirror the web SDK's step 1:1.
  const hint =
    rows.length === 0 && minEntries === 0
      ? "You can skip this if you're unsure. We'll identify directors and owners from the official registry. Adding them here speeds up the review."
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
            borderRadius: radius.sm,
            backgroundColor: colors.backgroundSecondary,
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <DashedBorder color={colors.border} radius={radius.sm} strokeWidth={1} />
          <MyazaText variant="bodyMedium" color={colors.textSecondary}>
            {hint}
          </MyazaText>
        </View>
      ) : null}

      <KeyPeopleSectionsList
        sections={sections}
        rows={rows}
        threshold={threshold}
        emailRequiredFor={emailRequiredFor}
        uboUnidentifiable={uboUnidentifiable}
        canAdd={canAdd}
        onRows={commit}
        onSheet={setSheet}
        onExemption={(next) => store.getState().setUboUnidentifiable(next)}
      />

      {!canAdd ? (
        <MyazaText
          variant="bodyMedium"
          color={colors.textMuted}
          style={{ textAlign: 'center', marginTop: spacing.lg }}
        >
          {`You can list up to ${MAX_KEY_PEOPLE_ROWS} people here.`}
        </MyazaText>
      ) : null}

      {/* Total-ownership summary at the DECISION point — the disabled
          Continue button always explains itself, wherever the offending
          card is. */}
      {totalPct > 0 ? (
        <View
          style={{
            marginTop: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: radius.sm,
            backgroundColor: overAllocated ? colors.errorBg : colors.backgroundSecondary,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 4,
          }}
        >
          <MyazaText variant="bodyMedium" color={overAllocated ? colors.error : colors.textMuted}>
            Total ownership listed
          </MyazaText>
          <MyazaText
            variant="bodyMedium"
            color={overAllocated ? colors.error : colors.textDark}
            style={{ fontWeight: '700' }}
          >
            {`${fmtPct(totalPct)}%`}
          </MyazaText>
        </View>
      ) : null}
      {overAllocated ? (
        <MyazaText variant="bodyMedium" color={colors.error} style={{ marginTop: spacing.xs }}>
          {`Together the percentages can't exceed 100%, so reduce them by ${fmtPct(totalPct - 100)}%.`}
        </MyazaText>
      ) : null}

      <View style={{ height: spacing.lg }} />
      <MyazaButton label="Continue" onPress={handleContinue} disabled={!canContinue} />

      {sheet && (sheet.mode === 'add' || editEntry) ? (
        <KeyPersonSheet
          emailRequiredFor={emailRequiredFor}
          mode={sheet.mode}
          section={sheet.section}
          corporateKyb={config.business?.keyPeople?.corporateKyb?.enabled === true}
          initial={
            editEntry ?? { ...emptyKeyPerson(SECTION_ROLE[sheet.section]), country: defaultCountry }
          }
          uboThreshold={threshold}
          otherPctTotal={editEntry ? totalPct - pctOf(editEntry) : totalPct}
          onSave={handleSave}
          onRemove={sheet.mode === 'edit' ? handleRemove : undefined}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}
