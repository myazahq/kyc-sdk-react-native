import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaInput } from '../components/MyazaInput';
import { CountryFlag } from '../components/CountryFlag';
import { Icon } from '../components/Icon';
import { groupCountriesByRegion, regionCountryName } from '../config/regions';
import { countrySelectOptions } from '../store/derive';

// ---------------------------------------------------------------------------
// Country selection for multi-region flows (`countries` has more than one).
//
// The pick sets the session's EFFECTIVE country, which every later step reads —
// the ID types on offer, the validators, the endpoints and chip capability all
// follow from it.
//
// Above a handful of countries a flat list stops being a chooser and becomes a
// scroll, so past SEARCH_THRESHOLD this switches to a searchable, region-grouped
// picker. Global Documents can offer ~200 countries.
// ---------------------------------------------------------------------------

/** Above this many offered countries the flat list becomes a searchable,
 * region-grouped picker. Exported because the sheet has to know too: the
 * picker pins its search box and therefore needs a non-scrolling body. */
export const COUNTRY_SEARCH_THRESHOLD = 5;

export const countrySelectMeta = {
  title: 'Where was your ID issued?',
  description: 'Choose the country that issued your identity document.',
};

export function CountrySelectStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  // Only an actual PICK counts as selected. `useEffectiveCountry` falls back to
  // the workflow's primary country, which on this screen would render a
  // highlighted row for a choice the user has not made yet.
  const selected = useKyc((s) => s.selectedCountry);

  // Multi-region flows carry `countries`; the KYB applicant leg does not, so
  // it offers the org's GRANTED countries instead — see countrySelectOptions.
  const serverConfig = useKyc((s) => s.serverConfig);
  const options = useMemo(
    () => countrySelectOptions({ config, serverConfig }),
    [config, serverConfig],
  );

  const pick = (country: string): void => {
    store.getState().setCountry(country);
    store.getState().nextStep();
  };

  if (options.length > COUNTRY_SEARCH_THRESHOLD) {
    return <CountryRegionPicker countries={options} selected={selected} onPick={pick} />;
  }

  return (
    <View>
      {options.map((country) => (
        <CountryRow
          key={country}
          code={country}
          name={regionCountryName(country)}
          selected={country === selected}
          onPress={() => pick(country)}
        />
      ))}
    </View>
  );
}

function CountryRegionPicker({
  countries,
  selected,
  onPick,
}: {
  countries: string[];
  selected: string | null;
  onPick: (country: string) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? countries.filter(
          (code) =>
            code.toLowerCase().includes(needle) ||
            regionCountryName(code).toLowerCase().includes(needle),
        )
      : countries;
    return groupCountriesByRegion(filtered);
  }, [countries, query]);

  const empty = groups.length === 0;

  return (
    // The search box stays put and the list owns its own scroll, so a
    // ~240-country flow does not scroll the search field off the top. That
    // relies on the SHEET rendering this step with `fillsViewport` — inside a
    // scroll view the nested list below would take an unbounded height, outgrow
    // the viewport, and drag the search box off the top with it.
    <View style={{ flex: 1 }}>
      <MyazaInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search countries…"
        autoCapitalize="none"
        prefix={<Icon name="search" size={18} color={colors.textSecondary} />}
      />
      <View style={{ height: spacing.md }} />

      {empty ? (
        <MyazaText variant="bodyMedium" style={{ textAlign: 'center', marginTop: spacing.lg }}>
          No countries match your search.
        </MyazaText>
      ) : (
        // `nestedScrollEnabled` stays: Android refuses to scroll a nested
        // same-direction list without it, and this is still nested on the
        // flat-list path and inside any future scrolling parent.
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
            <View key={group.region}>
              {/* Uppercase, tracked-out section label — Flutter's region
                  header. Lowercase text at the default weight read as another
                  list row rather than a divider. */}
              <MyazaText
                variant="bodySmall"
                color={colors.textSecondary}
                style={{
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  paddingHorizontal: spacing.xs,
                  paddingVertical: spacing.sm,
                }}
              >
                {group.region.toUpperCase()}
              </MyazaText>
              {group.countries.map((entry) => (
                <CountryRow
                  key={entry.code}
                  code={entry.code}
                  name={entry.name}
                  selected={entry.code === selected}
                  onPress={() => onPick(entry.code)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function CountryRow({
  code,
  name,
  selected,
  onPress,
}: {
  code: string;
  name: string;
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
      // Matches the Flutter SDK's CountryOptionTile exactly — the two had
      // drifted (24px flag / 12px padding here vs 32 / 16 there), which is why
      // the same screen looked like a different component on each platform. The
      // spacing and radius scales are identical across the SDKs, so there is
      // nothing platform-specific to reconcile: `md` means 16 on both.
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary50 : colors.background,
        marginBottom: spacing.sm,
      }}
    >
      <CountryFlag country={code} size={32} />
      <View style={{ width: 12 }} />
      <MyazaText variant="label" style={{ flex: 1, fontWeight: '500' }}>
        {name}
      </MyazaText>
      <Icon
        name="chevron-right"
        size={18}
        color={selected ? colors.primary : colors.textSecondary}
      />
    </Pressable>
  );
}
