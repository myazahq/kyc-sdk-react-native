import React from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { Icon } from '../../components/Icon';
import { MyazaText } from '../../components/Typography';
import type { AddressSearchHit, PlaceSuggestion } from '../../services/api';

/**
 * The candidate list for either backend.
 *
 * A FAILED call renders the same empty state as no matches: there is no
 * separate error state here, because either way the answer is the same, and
 * the two escapes below the list are how the applicant takes it.
 */
export function SearchResults({
  autocomplete,
  suggestions,
  hits,
  busy,
  onPickSuggestion,
  onPickHit,
}: {
  autocomplete: boolean;
  /** Places suggestions; null before anything has been asked. */
  suggestions: PlaceSuggestion[] | null;
  /** Basic-search hits; null before a submit. */
  hits: AddressSearchHit[] | null;
  busy: boolean;
  onPickSuggestion: (s: PlaceSuggestion) => void;
  onPickHit: (hit: AddressSearchHit) => void;
}): React.ReactElement | null {
  const { colors } = useTheme();
  const rows = autocomplete ? suggestions : hits;
  if (rows === null) return null;

  const frame = {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden' as const,
  };

  if (rows.length === 0) {
    return (
      <View style={frame}>
        <MyazaText
          variant="bodyMedium"
          color={colors.textSecondary}
          style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 }}
        >
          {autocomplete
            ? 'No matches. Use your location or place the pin by hand.'
            : 'No matches. Drag the map to place the pin instead.'}
        </MyazaText>
      </View>
    );
  }

  return (
    <View style={frame}>
      {rows.map((row, i) => {
        const isSuggestion = 'placeId' in row;
        const primary = isSuggestion ? row.mainText : row.label;
        const secondary = isSuggestion ? row.secondaryText : null;
        return (
          <Pressable
            key={isSuggestion ? row.placeId : `${row.lat},${row.lng},${i}`}
            disabled={busy}
            onPress={() => (isSuggestion ? onPickSuggestion(row) : onPickHit(row))}
            accessibilityRole="button"
            accessibilityLabel={primary}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              opacity: busy ? 0.6 : 1,
              backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
            })}
          >
            <View style={{ paddingTop: 2 }}>
              <Icon name="map-pin" size={15} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <MyazaText variant="bodyMedium" style={{ fontWeight: '500' }}>
                {primary}
              </MyazaText>
              {secondary ? (
                <MyazaText variant="bodySmall" color={colors.textSecondary}>
                  {secondary}
                </MyazaText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
