import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaInput } from '../components/MyazaInput';
import { MyazaSelect } from '../components/MyazaSelect';
import { CountryField } from '../components/CountryField';
import type { DialCodeOption } from '../components/DialCodePicker';
import { Icon } from '../components/Icon';
import { ALL_REGION_CODES, regionCountryName } from '../config/regions';
import { isValidContactEmail } from '../config/contact';
import {
  KEY_PERSON_ROLES,
  KEY_PERSON_ROLE_LABELS,
  type KeyPersonEntry,
} from '../config/keyPeople';
import type { KeyPersonRole } from '../types/business';

// ---------------------------------------------------------------------------
// One editable director/owner row — mirrors the web SDK's BusinessKeyPersonRow
// and the Flutter row 1:1: bordered card, "PERSON N" header with remove, then
// full name → role (select) → ownership % → country (full ISO select — a key
// person's ID can be issued anywhere, not just the registry country) → email.
// Validation is LIVE per field, like the web: a broken value says so as it is
// typed, while blank optional fields stay quiet.
// ---------------------------------------------------------------------------

/** Whether the row's role is an ownership one (% is only meaningful then). */
function isOwnerRole(role: KeyPersonRole): boolean {
  return role === 'beneficial_owner' || role === 'shareholder';
}

/** Every ISO-2 we can name, alphabetical — built once, shared by all rows. */
let countryOptions: DialCodeOption[] | null = null;
function allCountryOptions(): DialCodeOption[] {
  countryOptions ??= [...ALL_REGION_CODES]
    .map((code) => ({ code, name: regionCountryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countryOptions;
}

export function BusinessKeyPersonRow({
  row,
  index,
  onChange,
  onRemove,
  uboThreshold = 25,
}: {
  row: KeyPersonEntry;
  index: number;
  onChange: (patch: Partial<KeyPersonEntry>) => void;
  onRemove: () => void;
  /** Ownership % at/above which the server treats a person as a beneficial
   *  owner (the workflow's `keyPeople.ownershipThreshold`, default 25). */
  uboThreshold?: number;
}): React.ReactElement {
  const { colors } = useTheme();
  const options = useMemo(allCountryOptions, []);

  const nameInvalid = row.name !== '' && row.name.trim().length < 2;
  const emailInvalid = row.email.trim() !== '' && !isValidContactEmail(row.email.trim());
  const pct = row.ownershipPct.trim();
  const pctNum = Number(pct);
  const pctInvalid = pct !== '' && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100);
  // Surface the regulatory consequence as feedback: at/above the threshold the
  // server escalates this person to a beneficial owner regardless of the role
  // picked. Quiet when they already chose UBO — nothing new to say.
  const uboHint =
    !pctInvalid && pct !== '' && pctNum >= uboThreshold && row.role !== 'beneficial_owner';

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        padding: spacing.md,
        marginTop: spacing.sm + 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <MyazaText
          variant="bodySmall"
          color={colors.textSecondary}
          style={{ flex: 1, fontWeight: '600', letterSpacing: 0.6 }}
        >
          {`PERSON ${index + 1}`}
        </MyazaText>
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove person ${index + 1}`}
          hitSlop={8}
        >
          <Icon name="close" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <MyazaInput
        label="Full name"
        value={row.name}
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
        value={row.role}
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
        value={row.ownershipPct}
        onChangeText={(ownershipPct) => onChange({ ownershipPct })}
        placeholder={isOwnerRole(row.role) ? 'e.g. 60' : '—'}
        keyboardType="decimal-pad"
        suffix={
          <MyazaText variant="bodySmall" color={colors.textMuted}>
            %
          </MyazaText>
        }
        error={pctInvalid ? 'Enter a value between 0 and 100.' : null}
        helper={
          uboHint
            ? `At ${uboThreshold}% or more, this person counts as a beneficial owner.`
            : undefined
        }
      />

      <View style={{ height: spacing.sm }} />
      <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        Country <MyazaText variant="bodySmall" color={colors.textSecondary}>(where their ID was issued)</MyazaText>
      </MyazaText>
      {/* The SAME sheet as the phone field's dial-code picker (keyboard-aware,
          autofocused search, results pinned above the keys) — minus the dial
          codes. Two country pickers that feel different would read as a bug. */}
      <CountryField
        value={row.country || null}
        options={options}
        onChange={(country) => onChange({ country })}
      />

      <View style={{ height: spacing.sm }} />
      <MyazaInput
        label="Email (optional — used to send their verification link)"
        value={row.email}
        onChangeText={(email) => onChange({ email })}
        placeholder="name@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={emailInvalid ? 'Enter a valid email address.' : null}
      />
    </View>
  );
}
