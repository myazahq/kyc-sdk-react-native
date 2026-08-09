import React, { useMemo } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaInput } from '../components/MyazaInput';
import { MyazaSelect } from '../components/MyazaSelect';
import { CountryField } from '../components/CountryField';
import type { DialCodeOption } from '../components/DialCodePicker';
import { ALL_REGION_CODES, regionCountryName } from '../config/regions';
import { isValidContactEmail } from '../config/contact';
import {
  KEY_PERSON_ROLES,
  KEY_PERSON_ROLE_LABELS,
  type KeyPersonEntry,
} from '../config/keyPeople';
import type { KeyPersonRole } from '../types/business';

// ---------------------------------------------------------------------------
// The key-person FIELDS — full name → role → ownership % → country → email —
// with the same live per-field validation the old inline row had. No card
// chrome, no header: this is the body of the add/edit sheet (KeyPersonSheet),
// which owns the draft state and the save/remove actions.
// ---------------------------------------------------------------------------

/** Whether the role is an ownership one (% is only meaningful then). */
function isOwnerRole(role: KeyPersonRole): boolean {
  return role === 'beneficial_owner' || role === 'shareholder';
}

/** Every ISO-2 we can name, alphabetical — built once, shared by all mounts. */
let countryOptions: DialCodeOption[] | null = null;
function allCountryOptions(): DialCodeOption[] {
  countryOptions ??= [...ALL_REGION_CODES]
    .map((code) => ({ code, name: regionCountryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countryOptions;
}

export function KeyPersonForm({
  entry,
  onChange,
  uboThreshold = 25,
  combinedPctError = null,
}: {
  entry: KeyPersonEntry;
  onChange: (patch: Partial<KeyPersonEntry>) => void;
  /** Ownership % at/above which the server treats a person as a beneficial
   *  owner (the workflow's `keyPeople.ownershipThreshold`, default 25). */
  uboThreshold?: number;
  /**
   * Set when this draft's % would push the COMBINED ownership across all
   * people past 100% — shown on the % field as a warning. It never blocks
   * saving (the fix may live on a different person); the list's summary and
   * the disabled Continue enforce the total.
   */
  combinedPctError?: string | null;
}): React.ReactElement {
  const { colors } = useTheme();
  const options = useMemo(allCountryOptions, []);

  const nameInvalid = entry.name !== '' && entry.name.trim().length < 2;
  const emailInvalid = entry.email.trim() !== '' && !isValidContactEmail(entry.email.trim());
  const pct = entry.ownershipPct.trim();
  const pctNum = Number(pct);
  const pctInvalid = pct !== '' && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100);
  // Surface the regulatory consequence as feedback: at/above the threshold the
  // server escalates this person to a beneficial owner regardless of the role
  // picked. Quiet when they already chose UBO — nothing new to say.
  const uboHint =
    !pctInvalid && pct !== '' && pctNum >= uboThreshold && entry.role !== 'beneficial_owner';

  return (
    <View>
      <MyazaInput
        label="Full name"
        value={entry.name}
        onChangeText={(name) => onChange({ name })}
        placeholder="e.g. Bola Owner"
        // It's a person's name — start every word capitalized.
        autoCapitalize="words"
        error={nameInvalid ? 'Enter the person’s full name.' : null}
      />

      <View style={{ height: spacing.sm }} />
      <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        Role
      </MyazaText>
      <MyazaSelect
        value={entry.role}
        sheetTitle="Role"
        options={KEY_PERSON_ROLES.map((role) => ({
          value: role,
          label: KEY_PERSON_ROLE_LABELS[role],
        }))}
        onChange={(role) => onChange({ role })}
      />

      <View style={{ height: spacing.sm }} />
      <MyazaInput
        label="Ownership % (optional)"
        value={entry.ownershipPct}
        onChangeText={(ownershipPct) => onChange({ ownershipPct })}
        placeholder={isOwnerRole(entry.role) ? 'e.g. 60' : '—'}
        keyboardType="decimal-pad"
        suffix={
          <MyazaText variant="bodySmall" color={colors.textMuted}>
            %
          </MyazaText>
        }
        error={pctInvalid ? 'Enter a value between 0 and 100.' : combinedPctError}
        helper={
          uboHint
            ? `At ${uboThreshold}% or more, this person counts as a beneficial owner.`
            : undefined
        }
      />

      <View style={{ height: spacing.sm }} />
      <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        Country{' '}
        <MyazaText variant="bodySmall" color={colors.textSecondary}>
          (where their ID was issued)
        </MyazaText>
      </MyazaText>
      {/* The SAME sheet as the phone field's dial-code picker (keyboard-aware,
          autofocused search, results pinned above the keys) — minus the dial
          codes. Two country pickers that feel different would read as a bug. */}
      <CountryField
        value={entry.country || null}
        options={options}
        onChange={(country) => onChange({ country })}
      />

      <View style={{ height: spacing.sm }} />
      <MyazaInput
        label="Email (optional — used to send their verification link)"
        value={entry.email}
        onChangeText={(email) => onChange({ email })}
        placeholder="name@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={emailInvalid ? 'Enter a valid email address.' : null}
      />
    </View>
  );
}
