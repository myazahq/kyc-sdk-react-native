import React from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { Icon } from '../components/Icon';
import { CountryFlag } from '../components/CountryFlag';
import {
  rowNeedsEmail,
  KEY_PERSON_ROLE_LABELS,
  initialsOf,
  isKeyPersonRowValid,
  type KeyPersonEntry,
} from '../config/keyPeople';
import { regionCountryName } from '../config/regions';
import type { KeyPersonRole } from '../types/business';

// ---------------------------------------------------------------------------
// One saved key person, summarised — monogram avatar with their ID-issuing
// country flag badged on its corner, name, role · ownership meta, and the
// email their invite will go to. The whole card opens the edit sheet (the
// chevron is the affordance); removal lives INSIDE that sheet, so a stray tap
// can never delete a person.
//
// Same visual language as the applicant step's "this is me" cards, so the two
// screens read as one system.
// ---------------------------------------------------------------------------

export function KeyPersonCard({
  entry,
  emailRequiredFor,
  onPress,
  roleLabel,
  onRemove,
}: {
  entry: KeyPersonEntry;
  emailRequiredFor?: ReadonlySet<KeyPersonRole>;
  onPress: () => void;
  /** Names the hat the HOSTING section is about (sectioned step). */
  roleLabel?: string;
  /** The sectioned step's X: take this person out of that section. */
  onRemove?: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const name = entry.name.trim() || 'Unnamed person';
  const country = entry.country.trim() ? entry.country.trim().toUpperCase() : null;
  const pct = entry.ownershipPct.trim();
  // A row persisted by the old inline UI (or interrupted mid-edit) may be
  // incomplete — the card says so instead of silently blocking Continue. A
  // missing REQUIRED email gets named specifically: "incomplete" on a row
  // whose name, role and country are all filled reads as a bug.
  const required = emailRequiredFor ?? new Set<KeyPersonRole>();
  const incomplete = !isKeyPersonRowValid(entry, required);
  const problem =
    rowNeedsEmail(entry, required) && entry.email.trim() === '' && entry.name.trim().length >= 2
      ? 'Email required, tap to add'
      : 'Incomplete, tap to finish';

  const meta = [
    roleLabel ?? KEY_PERSON_ROLE_LABELS[entry.role],
    entry.title.trim() || null,
    pct ? `${pct}% ownership` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  // The flag alone doesn't say WHICH country — spell it out, alongside the
  // email their invite goes to.
  const detail = [country ? regionCountryName(country) : null, entry.email.trim() || null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${name}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: incomplete ? colors.error : colors.border,
        borderRadius: radius.sm,
        backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
        padding: spacing.md - 2,
        marginBottom: spacing.sm,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primary100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '700' }}>
          {initialsOf(name)}
        </MyazaText>
        {country ? (
          <View
            style={{
              position: 'absolute',
              bottom: -2,
              right: -4,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: colors.background,
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
        <MyazaText variant="bodySmall" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 1 }}>
          {meta}
        </MyazaText>
        {incomplete ? (
          <MyazaText variant="bodySmall" color={colors.error} numberOfLines={1} style={{ marginTop: 1 }}>
            {problem}
          </MyazaText>
        ) : detail !== '' ? (
          <MyazaText variant="bodySmall" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 1 }}>
            {detail}
          </MyazaText>
        ) : null}
      </View>

      <Icon name="pencil" size={16} color={colors.textMuted} />
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name} from this section`}
          hitSlop={8}
          onPress={onRemove}
          style={{ marginLeft: 4, padding: 4 }}
        >
          <Icon name="close" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
