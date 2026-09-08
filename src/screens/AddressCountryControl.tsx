import React, { useMemo } from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { CountryField } from '../components/CountryField';
import { CountryFlag } from '../components/CountryFlag';
import { ALL_REGION_CODES, regionCountryName } from '../config/regions';
import { configScope } from '../lib/scope';
import { inferredCountry } from '../lib/inferred-country';
import type { SupportedCountry } from '../types/config';

// ---------------------------------------------------------------------------
// The declared-country control for ADDRESS-SCOPED flows — mounted on the
// Proof of Address step (the Didit PoA model: the applicant names their
// market, then uploads the document). Mirrors the web SDK's
// steps/address/AddressCountryControl: the pick drives the document kinds on
// offer, the search filter, the map's opening view, the PoA vendor market,
// and rides the submission as the verification's country. The pin stays the
// ground truth regardless.
//
// The picker is the house country sheet (CountryField) in its region-grouped
// mode, with the inferred country (server geo first, device locale second)
// pinned on top as "Your location" — the web's region menu, in the sheet the
// rest of the mobile flow uses (user decision 2026-09-06).
// ---------------------------------------------------------------------------

/** What the picker offers: the org's accepted list, else every country. */
export function poaOfferedCountries(configured: string[] | undefined): string[] {
  const list = (configured ?? [])
    .map((c) => c.toUpperCase())
    .filter((c) => ALL_REGION_CODES.includes(c));
  return list.length > 0 ? list : ALL_REGION_CODES;
}

export function AddressCountryControl(): React.ReactElement | null {
  const config = useKycConfig();
  const store = useKycStore();
  const { colors } = useTheme();
  const selected = useKyc((s) => s.selectedCountry);
  const geo = useKyc((s) => s.serverConfig.geoCountry);

  const scoped = configScope(config) === 'address';
  const offered = useMemo(
    () => poaOfferedCountries(config.proofOfAddress?.countries),
    [config.proofOfAddress?.countries],
  );
  const options = useMemo(
    () => offered.map((code) => ({ code, name: regionCountryName(code) })),
    [offered],
  );

  if (!scoped) return null;

  // Only a country the applicant PICKED shows as selected: the address scope
  // has no seeded country to show (web's AddressCountryControl, same rule), and
  // showing config.country here while the attachment area's flag read
  // `selectedCountry` had the control and the drop zone disagreeing.
  const value = selected ?? null;
  const pick = (code: string) => store.getState().setCountry(code as SupportedCountry);

  // One accepted country = nothing to pick. Show it as a settled fact rather
  // than a sheet that could only ever re-answer itself.
  if (offered.length === 1) {
    const only = offered[0]!;
    // The label sits ABOVE the field, as it does on every other input (user
    // decision 2026-09-05) — the read-only box is CountryField's trigger
    // without the chevron, so the settled and pickable states line up.
    return (
      <View style={{ marginBottom: spacing.lg }}>
        <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
          Country
        </MyazaText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.backgroundSecondary,
          }}
        >
          <CountryFlag country={only} size={20} />
          <View style={{ width: spacing.sm }} />
          <MyazaText variant="body" style={{ flex: 1 }} numberOfLines={1}>
            {regionCountryName(only)}
          </MyazaText>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        Country
      </MyazaText>
      <CountryField
        value={value}
        options={options}
        onChange={pick}
        // The inferred country pinned on top of the sheet; the sheet itself
        // drops it when the org's list does not carry it.
        geoCountry={inferredCountry(geo)}
        grouped
        placeholder="Select country"
        searchPlaceholder="Search countries"
      />
    </View>
  );
}
