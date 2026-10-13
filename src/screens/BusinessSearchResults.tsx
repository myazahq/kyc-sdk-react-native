import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { CountryFlag } from '../components/CountryFlag';
import { Icon } from '../components/Icon';
import { UiInput } from '../components/UiInput';
import { UiText } from '../components/Typography';
import { useTheme } from '../components/runtime';
import { radius } from '../config/theme';
import type { BusinessSearchHit } from '../services/api';

// The result list: count first ("40 results" says whether to narrow before you
// start reading), a filter that narrows without re-searching, and one row per
// candidate. Split from BusinessSearch (200-line rule). Every dimension here —
// 40px filter, 12px row padding, 6px row gaps, 256px list — is the web SDK's,
// so the two render the same screen.

export function BusinessSearchResults({
  country,
  hits,
  shown,
  truncated,
  filter,
  onFilter,
  onPicked,
}: {
  country: string;
  hits: BusinessSearchHit[];
  shown: BusinessSearchHit[];
  truncated: boolean;
  filter: string;
  onFilter: (value: string) => void;
  onPicked: (hit: BusinessSearchHit) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <>
      {/* Count first: "40 results" says whether to narrow before you start
          reading, which a bare list does not. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 12,
        }}
      >
        <UiText variant="bodyMedium" color={colors.textSecondary}>
          {shown.length === hits.length
            ? `${hits.length} results`
            : `${shown.length} of ${hits.length} results`}
        </UiText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <UiText variant="bodyMedium" color={colors.textSecondary}>
            Filter
          </UiText>
          <View style={{ width: 176 }}>
            <UiInput
              value={filter}
              onChangeText={onFilter}
              placeholder="Name or number"
              autoCorrect={false}
              height={40}
              fontSize={14}
              prefix={<Icon name="filter" size={14} color={colors.textMuted} />}
            />
          </View>
        </View>
      </View>
      <ScrollView style={{ maxHeight: 256, marginTop: 12 }} nestedScrollEnabled>
        {shown.map((hit) => (
          <Pressable
            key={`${hit.registrationNumber}-${hit.name}`}
            accessibilityRole="button"
            onPress={() => onPicked(hit)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.sm,
              padding: 12,
              marginBottom: 6,
            }}
          >
            <Icon name="building-2" size={16} color={colors.textSecondary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <UiText variant="label" color={colors.textDark} numberOfLines={1}>
                {hit.name}
              </UiText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <CountryFlag country={country} size={14} />
                <UiText variant="bodySmall" color={colors.textSecondary}>
                  {hit.registrationNumber}
                </UiText>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {shown.length === 0 && (
        <UiText variant="bodyMedium" color={colors.textSecondary} style={{ marginTop: 12 }}>
          Nothing here matches "{filter.trim()}". Clear the filter to see all {hits.length}.
        </UiText>
      )}
      {truncated && (
        <UiText variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 6 }}>
          Showing the first {hits.length}. Add more of the name to narrow it down.
        </UiText>
      )}
    </>
  );
}
