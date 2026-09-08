import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { spacing } from '../../config/theme';
import { useKycStore, useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { uuid } from '../../utils/uuid';
import { AUTOCOMPLETE_DEBOUNCE_MS, SEARCH_MIN_QUERY_LENGTH } from '../../lib/address-flow';
import { AddressSearchField } from './AddressSearchField';
import { CurrentLocationRow } from './CurrentLocationRow';
import { SearchResults } from './SearchResults';
import type { AddressSearchHit, PlaceSuggestion } from '../../services/api';

// ---------------------------------------------------------------------------
// Screen 1: find the address the way a person holds it, as words.
//
// Places autocomplete when the platform has it (as-you-type, debounced, ONE
// session token per typing session — the billing unit), the explicit-submit
// basic search otherwise, and two always-present escapes: current location and
// "place a pin instead". Every path lands on the pin screen.
//
// A failed call renders the SAME empty state as no matches: there is no
// separate error state on this list, because either way the answer is to use
// one of the escapes.
// ---------------------------------------------------------------------------

/** What either backend hands back once resolved to coordinates. */
export interface ResolvedSearch {
  lat: number;
  lng: number;
  houseNumber: string | null;
  road: string | null;
  formatted?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  /** ISO-2 of the picked address's own country (the declaration follows it). */
  country?: string | null;
}

export function SearchScreen({
  country,
  autocomplete,
  near,
  locationHint,
  locating,
  onResolved,
  onUseMyLocation,
  onPinInstead,
}: {
  country?: string | null;
  /** Which backend the server offers. */
  autocomplete: boolean;
  /** The device fix: a ranking bias so nearby streets come first. */
  near?: { lat: number; lng: number } | null;
  /** The device's resolved current address, shown ON the row. */
  locationHint: string | null;
  locating: boolean;
  onResolved: (hit: ResolvedSearch) => void;
  onUseMyLocation: () => void;
  onPinInstead: () => void;
}): React.ReactElement {
  const store = useKycStore();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[] | null>(null);
  const [hits, setHits] = useState<AddressSearchHit[] | null>(null);
  const session = useRef(uuid());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autocomplete) return undefined;
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < SEARCH_MIN_QUERY_LENGTH) {
      setSuggestions(null);
      return undefined;
    }
    debounce.current = setTimeout(() => {
      void store
        .getState()
        .api.addressAutocomplete(q, session.current, country ?? undefined, near ?? null)
        .then((res) => setSuggestions(res.suggestions))
        .catch(() => setSuggestions([]));
    }, AUTOCOMPLETE_DEBOUNCE_MS);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // The fix is read by value: a fresh object with the same coordinates must
    // not re-run the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, autocomplete, country, store, near?.lat, near?.lng]);

  const pickSuggestion = useCallback(
    async (s: PlaceSuggestion) => {
      setBusy(true);
      try {
        const { place } = await store.getState().api.addressPlace(s.placeId, session.current);
        // A details call CLOSES the Places session, so the next keystroke must
        // start a new one or the billing unit silently spans two searches.
        session.current = uuid();
        onResolved(place);
      } catch {
        setSuggestions([]);
      } finally {
        setBusy(false);
      }
    },
    [onResolved, store],
  );

  /** The basic backend forbids autocomplete, so the query only goes out on an
   *  explicit submit — the budget belongs to the query the person meant. */
  const runBasicSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < SEARCH_MIN_QUERY_LENGTH || busy) return;
    setBusy(true);
    try {
      const res = await store.getState().api.addressSearch(q, country ?? undefined);
      setHits(res.results);
    } catch {
      setHits([]);
    } finally {
      setBusy(false);
    }
  }, [busy, country, query, store]);

  const canSubmit = query.trim().length >= SEARCH_MIN_QUERY_LENGTH && !busy;

  return (
    <View>
      <AddressSearchField
        value={query}
        onChangeText={setQuery}
        busy={busy}
        showSubmit={!autocomplete}
        canSubmit={canSubmit}
        autoFocus={autocomplete}
        onSubmit={() => void runBasicSearch()}
      />

      <SearchResults
        autocomplete={autocomplete}
        suggestions={suggestions}
        hits={hits}
        busy={busy}
        onPickSuggestion={(s) => void pickSuggestion(s)}
        onPickHit={(hit) => {
          setQuery('');
          setHits(null);
          onResolved({ ...hit, formatted: hit.label });
        }}
      />

      <View style={{ height: spacing.md }} />
      <CurrentLocationRow hint={locationHint} locating={locating} onPress={onUseMyLocation} />

      <View style={{ height: spacing.md }} />
      <Pressable
        onPress={onPinInstead}
        accessibilityRole="button"
        style={{ alignItems: 'center', paddingVertical: spacing.sm }}
      >
        <MyazaText
          variant="bodyMedium"
          color={colors.textSecondary}
          style={{ textDecorationLine: 'underline' }}
        >
          Place a pin on the map instead
        </MyazaText>
      </Pressable>
    </View>
  );
}
