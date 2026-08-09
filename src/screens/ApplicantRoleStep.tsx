import React, { useState } from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MyazaInput } from '../components/MyazaInput';
import { MyazaSelect } from '../components/MyazaSelect';
import { Pressable } from 'react-native';
import { Icon } from '../components/Icon';
import { CountryFlag } from '../components/CountryFlag';
import {
  KEY_PERSON_ROLE_LABELS,
  KEY_PERSON_ROLES,
  isKeyPersonRowValid,
  namesLooselyMatch,
} from '../config/keyPeople';
import type { ApplicantRole } from '../types/business';

// ---------------------------------------------------------------------------
// The applicant declares who they are to the business, then verifies their own
// identity in the ordinary individual capture steps that follow.
//
// When key people were entered earlier, the applicant may BE one of them — so
// the step first asks "which of these is you?" (pre-selected when the
// consumer's userData name matches). Picking themselves flags that entry on
// the submission and the server merges the two records: one person, one KYC,
// one screening, no duplicate invite. "I'm not one of these" falls through to
// the plain role + name form. Mirrors the web SDK's ApplicantRoleStep.
// ---------------------------------------------------------------------------

export const applicantRoleMeta = {
  title: 'Now verify your own identity',
  description:
    'Tell us your role at the business, then verify your identity with a government-issued ID.',
};

const APPLICANT_ROLES: ApplicantRole[] = [...KEY_PERSON_ROLES, 'authorized_representative'];

const APPLICANT_ROLE_LABELS: Record<ApplicantRole, string> = {
  ...KEY_PERSON_ROLE_LABELS,
  authorized_representative: 'Authorized representative',
};

/** "Richard Ingwe" → "RI" — the avatar monogram. */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('');
}

export function ApplicantRoleStep(): React.ReactElement {
  const store = useKycStore();
  const config = useKycConfig();
  const { colors } = useTheme();
  const stored = useKyc((s) => s.businessApplication);

  // The valid entered people, keeping their ORIGINAL index — the payload flag
  // is index-based, so the list and the submission can never disagree.
  const people = stored.keyPeople
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isKeyPersonRowValid(row));
  const hasPeople = people.length > 0;

  const propName = [config.userData?.firstName, config.userData?.lastName]
    .filter(Boolean)
    .join(' ');

  // Tri-state: a person's index, 'other', or nothing chosen yet. First arrival
  // pre-selects the applicant's own entry when the userData name matches
  // (they still confirm) — a stored choice always wins.
  const [selection, setSelection] = useState<number | 'other' | null>(() => {
    if (stored.applicantKeyPersonIndex !== null) return stored.applicantKeyPersonIndex;
    if (stored.applicantRole) return 'other';
    if (propName) {
      const match = people.find(({ row }) => namesLooselyMatch(propName, row.name));
      if (match) return match.index;
    }
    return null;
  });
  const [role, setRole] = useState<ApplicantRole | null>(stored.applicantRole);
  // Pre-filled from the consumer's userData when nothing was typed yet — the
  // applicant is usually the person the integrator already knows about.
  const [name, setName] = useState(() => stored.applicantName || propName);

  const handleContinue = (): void => {
    if (typeof selection === 'number') {
      const person = stored.keyPeople[selection];
      if (!person) return;
      store.getState().setApplicant(person.role, person.name.trim(), selection);
      // Their entry already answered "where was your ID issued?" — the leg
      // uses that country and the country-select step is skipped (see
      // derive.hasCountrySelect).
      if (person.country.trim() !== '') {
        store.getState().setCountry(person.country.trim().toUpperCase());
      }
    } else {
      if (!role) return;
      store.getState().setApplicant(role, name, null);
    }
    store.getState().nextStep();
  };

  const canContinue = hasPeople
    ? typeof selection === 'number' || (selection === 'other' && role !== null)
    : role !== null;

  return (
    <View>
      {/* Regulatory note card — the web SDK's ScanFace callout (rounded-xl,
          p-4, 36px icon tile). */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.backgroundSecondary,
          borderRadius: radius.sm,
          padding: spacing.md,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.xs,
            backgroundColor: colors.primary100,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.sm + 4,
          }}
        >
          <Icon name="scan-face" size={18} color={colors.primary} />
        </View>
        <MyazaText variant="bodySmall" style={{ flex: 1 }}>
          Regulations require the person submitting a business application to verify their own
          identity. This only takes a minute.
        </MyazaText>
      </View>

      {hasPeople ? (
        <>
          <View style={{ height: spacing.lg }} />
          <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
            Are you one of the people you listed?
          </MyazaText>
          {people.map(({ row, index }) => (
            <SelfCard
              key={index}
              name={row.name.trim()}
              subtitle={KEY_PERSON_ROLE_LABELS[row.role]}
              ownershipPct={row.ownershipPct.trim() || null}
              country={row.country.trim() ? row.country.trim().toUpperCase() : null}
              selected={selection === index}
              onPress={() => setSelection(index)}
            />
          ))}
          <SelfCard
            name="I'm not one of these people"
            other
            selected={selection === 'other'}
            onPress={() => setSelection('other')}
          />
          {typeof selection === 'number' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: colors.primary100,
                borderRadius: radius.xs,
                paddingHorizontal: spacing.sm + 4,
                paddingVertical: spacing.sm + 2,
                marginTop: spacing.xs,
              }}
            >
              <Icon name="check" size={14} color={colors.primary} />
              <MyazaText variant="bodySmall" style={{ flex: 1, marginLeft: spacing.xs + 2 }}>
                You'll verify your identity at the end of this form — no separate invite link is
                needed for you.
              </MyazaText>
            </View>
          ) : null}
        </>
      ) : null}

      {!hasPeople || selection === 'other' ? (
        <>
          <View style={{ height: spacing.lg }} />
          <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
            Your role at the business
          </MyazaText>
          <MyazaSelect
            value={role}
            hint="Select your role"
            sheetTitle="Your role"
            options={APPLICANT_ROLES.map((option) => ({
              value: option,
              label: APPLICANT_ROLE_LABELS[option],
            }))}
            onChange={setRole}
          />

          <View style={{ height: spacing.md }} />
          <MyazaInput
            label="Full name (optional)"
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            autoCapitalize="words"
          />
        </>
      ) : null}

      <View style={{ height: spacing.xl }} />
      <MyazaButton label="Continue" onPress={handleContinue} disabled={!canContinue} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// One selectable "this is me" card — monogram avatar with the person's
// ID-issuing-country flag badged on its corner, name + role/ownership, and a
// radio dot. The "someone else" variant swaps the avatar for an add-person
// icon on a dashed border. Mirrors the web SDK's ApplicantRoleStep cards 1:1.
// ---------------------------------------------------------------------------

function SelfCard({
  name,
  subtitle,
  ownershipPct,
  country,
  other = false,
  selected,
  onPress,
}: {
  name: string;
  subtitle?: string;
  ownershipPct?: string | null;
  country?: string | null;
  /** The dashed "I'm not one of these people" variant. */
  other?: boolean;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: selected ? 1.5 : 1,
        borderStyle: other && !selected ? 'dashed' : 'solid',
        borderColor: selected ? colors.primary : colors.border,
        borderRadius: radius.sm,
        backgroundColor: selected ? colors.primary50 : colors.background,
        padding: spacing.md - 2,
        marginBottom: spacing.sm,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: other && !selected ? colors.backgroundSecondary : colors.primary100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {other ? (
          <Icon name="user-plus" size={18} color={selected ? colors.primary : colors.textMuted} />
        ) : (
          <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '700' }}>
            {initialsOf(name)}
          </MyazaText>
        )}
        {country ? (
          <View
            style={{
              position: 'absolute',
              bottom: -2,
              right: -4,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: selected ? colors.primary50 : colors.background,
              overflow: 'hidden',
            }}
          >
            <CountryFlag country={country} size={16} />
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1, minWidth: 0, marginLeft: spacing.sm + 4 }}>
        <MyazaText variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '600' }}>
          {name}
        </MyazaText>
        {subtitle ? (
          <MyazaText variant="bodySmall" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 1 }}>
            {subtitle}
            {ownershipPct ? ` · ${ownershipPct}% ownership` : ''}
          </MyazaText>
        ) : null}
      </View>

      {/* Radio dot — filled with a check when selected. */}
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: spacing.sm,
        }}
      >
        {selected ? <Icon name="check" size={12} color={colors.background} /> : null}
      </View>
    </Pressable>
  );
}
