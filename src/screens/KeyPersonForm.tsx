import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaInput } from '../components/MyazaInput';
import { Icon } from '../components/Icon';
import { OwnershipSlider } from '../components/OwnershipSlider';
import { CountryField } from '../components/CountryField';
import type { DialCodeOption } from '../components/DialCodePicker';
import { ALL_REGION_CODES, regionCountryName } from '../config/regions';
import { isValidContactEmail } from '../config/contact';
import { rowNeedsEmail, type KeyPersonEntry } from '../config/keyPeople';
import {
  primaryRole,
  rolesOf,
  type KeyPeopleSection as SectionKey,
} from '../config/keyPeopleSections';
import type { KeyPersonRole } from '../types/business';
import { KeyPersonKindToggle } from './KeyPersonKindToggle';
import { KeyPersonOwners } from './KeyPersonOwners';
import { KeyPersonRoleChips } from './KeyPersonRoleChips';

// ---------------------------------------------------------------------------
// The key-person FIELDS, scoped by the SECTION that opened the sheet: the
// section already said what this person is, so no coarse role dropdown — the
// UBO form asks name/stake/country/email, the shareholder form adds the
// individual-or-company toggle, and the representative form picks between the
// real classifications (chips) with the human nuance ("CFO, Board Member")
// captured as a free-text title. Mirrors the web SDK's KeyPersonForm 1:1.
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
  section,
  corporateKyb = false,
  onChange,
  uboThreshold = 25,
  combinedPctError = null,
  emailRequiredFor,
}: {
  entry: KeyPersonEntry;
  /** The section whose add-tile or card opened the sheet. */
  section: SectionKey;
  /** The workflow sends corporate shareholders their own KYB application -
   *  the callout must tell that truth instead of the screening-only one. */
  corporateKyb?: boolean;
  onChange: (patch: Partial<KeyPersonEntry>) => void;
  /** Roles whose email is mandatory (they are sent a verification link). */
  emailRequiredFor?: ReadonlySet<KeyPersonRole>;
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
  const needsEmail = rowNeedsEmail(entry, emailRequiredFor ?? new Set());
  // COLLAPSED by default so the company sheet stays five fields; open when
  // owners already exist (a restored draft, a look-through find). The
  // capability is one tap away, not one field more. Mirrors the web SDK.
  const [showOwners, setShowOwners] = useState((entry.owners?.length ?? 0) > 0);
  const pct = entry.ownershipPct.trim();
  const pctNum = Number(pct);
  const pctInvalid = pct !== '' && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100);
  // Surface the regulatory consequence as feedback: at/above the threshold the
  // server escalates this person to a beneficial owner regardless of the role
  // picked. Quiet when they already chose UBO — nothing new to say.
  const corp = entry.isCorporate;
  const roles = rolesOf(entry);
  const uboHint =
    !corp && !pctInvalid && pct !== '' && pctNum >= uboThreshold && !roles.includes('beneficial_owner');
  const belowThresholdNote =
    section === 'ubos' && !pctInvalid && pct !== '' && pctNum > 0 && pctNum < uboThreshold;

  const setRoles = (next: KeyPersonRole[]): void =>
    onChange({ roles: next, role: primaryRole(next) });

  return (
    <View>
      {/* Only shareholders can be a company: a beneficial owner is a natural
          person in every regime that defines one, and a representative form
          is about the people who act. */}
      {section === 'shareholders' ? (
        <>
          <KeyPersonKindToggle
            isCorporate={corp}
            onChange={(isCorporate) =>
              // Beneficial ownership is a claim about a person, so switching
              // to a company reads the role set down rather than leaving an
              // impossible one.
              onChange({
                isCorporate,
                ...(isCorporate
                  ? {
                      roles: roles.map((r) => (r === 'beneficial_owner' ? 'shareholder' : r)),
                      role: primaryRole(
                        roles.map((r) => (r === 'beneficial_owner' ? 'shareholder' : r)),
                      ),
                    }
                  : { registrationNumber: '', owners: [] }),
              })
            }
          />
          <View style={{ height: spacing.sm }} />
        </>
      ) : null}
      <MyazaInput
        label={corp ? 'Company name' : 'Full name'}
        value={entry.name}
        onChangeText={(name) => onChange({ name })}
        placeholder={corp ? 'e.g. Acme Holdings Ltd' : 'e.g. Bola Owner'}
        // It's a name — start every word capitalized.
        autoCapitalize="words"
        error={
          nameInvalid
            ? `Enter the ${corp ? 'registered company name' : 'person’s full name'}.`
            : null
        }
      />

      {section === 'representatives' ? (
        <>
          <View style={{ height: spacing.sm }} />
          <KeyPersonRoleChips roles={roles} onRoles={setRoles} />
        </>
      ) : null}

      {!corp ? (
        <>
          <View style={{ height: spacing.sm }} />
          <MyazaInput
            label="Position or title (optional)"
            value={entry.title}
            onChangeText={(title) => onChange({ title })}
            placeholder="e.g. CFO, Board Member"
            autoCapitalize="words"
            autoCorrect={false}
          />
        </>
      ) : null}

      <View style={{ height: spacing.sm }} />
      <MyazaInput
        label="Ownership % (optional)"
        value={entry.ownershipPct}
        onChangeText={(ownershipPct) => onChange({ ownershipPct })}
        placeholder="0"
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
            : belowThresholdNote
              ? `Below ${uboThreshold}% they will be recorded as a shareholder.`
              : undefined
        }
      />
      <View style={{ height: spacing.xs }} />
      {/* The slider rests at 0 for an undeclared stake; only a drag writes a
          value, so an untouched slider still submits "not declared". */}
      <OwnershipSlider
        value={pct !== '' && Number.isFinite(Number(pct)) ? Number(pct) : 0}
        onChange={(next) => onChange({ ownershipPct: String(next) })}
      />

      {corp ? (
        <>
          <View style={{ height: spacing.sm }} />
          <MyazaInput
            label="Registration number (optional)"
            value={entry.registrationNumber}
            onChangeText={(registrationNumber) => onChange({ registrationNumber })}
            placeholder="e.g. RC123456"
            autoCapitalize="characters"
          />
        </>
      ) : null}

      <View style={{ height: spacing.sm }} />
      <MyazaText variant="label" style={{ marginBottom: spacing.sm }}>
        Country{' '}
        <MyazaText variant="bodyMedium" color={colors.textSecondary}>
          {corp ? '(of incorporation)' : '(where their ID was issued)'}
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

      {corp && !showOwners ? (
        <>
          <View style={{ height: spacing.sm }} />
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowOwners(true)}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
          >
            <Icon name="chevron-right" size={16} color={colors.textSecondary} />
            <MyazaText
              variant="bodyMedium"
              color={colors.textSecondary}
              style={{ fontWeight: '500' }}
            >
              Add the people who own it (optional)
            </MyazaText>
          </Pressable>
        </>
      ) : null}
      {corp && showOwners ? (
        <>
          <View style={{ height: spacing.sm }} />
          <KeyPersonOwners
            owners={entry.owners ?? []}
            companyName={entry.name}
            onChange={(owners) => onChange({ owners })}
          />
        </>
      ) : null}

      <View style={{ height: spacing.sm }} />
      <MyazaInput
        label={
          needsEmail
            ? 'Email *'
            : corp
              ? 'Email (optional)'
              : 'Email (optional, used to send their verification link)'
        }
        value={entry.email}
        onChangeText={(email) => onChange({ email })}
        placeholder="name@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={emailInvalid ? 'Enter a valid email address.' : null}
        helper={
          needsEmail && entry.email.trim() === ''
            ? 'Required: this is how they receive their own verification link.'
            : undefined
        }
      />

      {/* What actually happens to a company on this list, stated as a callout
          rather than buried in a field helper, because it answers the question
          every applicant has at this exact point ("is the company going to be
          asked for a selfie?"). Deliberately OUR facts, not a promise of a
          nested KYB we do not run. Mirrors the web SDK's callout. */}
      {corp ? (
        <View
          style={{
            marginTop: spacing.md,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            borderRadius: radius.sm,
            backgroundColor: colors.primary50,
            padding: 12,
          }}
        >
          <View style={{ marginTop: 2 }}>
            <Icon name="info" size={16} color={colors.primary} />
          </View>
          <MyazaText variant="bodyMedium" color={colors.textSecondary} style={{ flex: 1 }}>
            {corporateKyb
              ? 'This company will need its own KYB verification: it receives a link to a business application of its own, where the people who own it are identified. We also screen it against sanctions lists.'
              : 'A company is never asked to verify an identity. We check it against sanctions lists, and the people who own it are reviewed separately, so list its owners above if you know them.'}
          </MyazaText>
        </View>
      ) : null}
    </View>
  );
}
