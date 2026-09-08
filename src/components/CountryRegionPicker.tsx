import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { groupCountriesByRegion, pinGeoRow, regionCountryName } from '../config/regions';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { MyazaInput } from './MyazaInput';
import { CountryFlag } from './CountryFlag';
import { Icon } from './Icon';
import { GeoBadge } from './GeoBadge';

// ---------------------------------------------------------------------------
// Searchable, region-grouped country picker for the country-select step. Used
// when a workflow offers many countries (Global Documents): a flat 200-country
// list is a scroll, not a chooser, so this adds a pinned search box and
// continent headers over a bounded scroll area. Mirrors the web SDK's
// CountryRegionPicker and Flutter's country_region_picker.dart.
//
// Split from CountrySelectStep (200-line rule); the step keeps the flat list
// and the threshold that decides between the two.
// ---------------------------------------------------------------------------

export function CountryRegionPicker({
  countries,
  selected,
  geoCountry,
  onPick,
}: {
  countries: string[];
  selected: string | null;
  /**
   * The visitor's IP country. Lifted out of its continent to the very top and
   * tagged, so the one country most likely to be theirs is the first thing
   * they see rather than something to scroll for.
   */
  geoCountry?: string | null;
  onPick: (country: string) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const { pinned, groups } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = needle
      ? countries.filter(
          (code) =>
            code.toLowerCase().includes(needle) ||
            regionCountryName(code).toLowerCase().includes(needle),
        )
      : countries;
    const split = pinGeoRow(visible, geoCountry, (code) => code);
    return { pinned: split.pinned, groups: groupCountriesByRegion(split.rest) };
  }, [countries, query, geoCountry]);

  const empty = groups.length === 0 && pinned === null;

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
          {pinned ? (
            <CountryRow
              code={pinned}
              name={regionCountryName(pinned)}
              selected={pinned === selected}
              badge="Your location"
              onPress={() => onPick(pinned)}
            />
          ) : null}
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

/**
 * One selectable country row, shared by the flat list and the region picker
 * so the two cannot drift apart. `badge` tags the pinned geo row; it is the
 * same control in a second position, differing only by the tag.
 */
export function CountryRow({
  code,
  name,
  selected,
  badge,
  onPress,
}: {
  code: string;
  name: string;
  selected: boolean;
  badge?: string;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={badge ? `${name}, ${badge.toLowerCase()}` : name}
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
      {badge ? <GeoBadge label={badge} /> : null}
      <Icon
        name="chevron-right"
        size={18}
        color={selected ? colors.primary : colors.textSecondary}
      />
    </Pressable>
  );
}
