import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { MyazaAlert } from '../components/MyazaAlert';
import { MyazaButton } from '../components/MyazaButton';
import { MyazaInput } from '../components/MyazaInput';
import { MyazaSelect } from '../components/MyazaSelect';
import { MyazaText } from '../components/Typography';
import { Icon } from '../components/Icon';
import { BusinessSearchResults } from './BusinessSearchResults';
import { useKyc, useKycStore, useTheme } from '../components/runtime';
import { spacing } from '../config/theme';
import type { BusinessSearchHit } from '../services/api';

// ─── Finding the company by name, because that is what people know ───────────
//
// A registration number is on a certificate in a drawer; the name is in the
// applicant's head. Asking for the number first turns the very first field
// into a search of their own filing cabinet, which is where KYB applications
// are abandoned.
//
// The search itself is FREE and read-only; only picking a result leads to the
// paid register check. It fires on an explicit submit, never on keystroke: a
// debounce spends the register's small, uncontracted rate-limit budget on
// every prefix nobody asked for. Sizes and rhythm mirror the web SDK's
// BusinessSearch (12px block gaps, 48px input/button) — keep them in lockstep.

type SearchState =
  | { phase: 'idle' }
  | { phase: 'searching' }
  | { phase: 'results'; hits: BusinessSearchHit[]; truncated: boolean }
  | { phase: 'unavailable' };

export function BusinessSearch({
  country,
  onPicked,
  onManualEntry,
}: {
  country: string;
  onPicked: (hit: BusinessSearchHit) => void;
  onManualEntry: () => void;
}): React.ReactElement {
  const store = useKycStore();
  const { colors } = useTheme();
  const region = useKyc((s) => s.business.subdivisionCode);
  const [query, setQuery] = useState('');
  // Narrows what came back; it never replaces the search. Matches the name AND
  // the number — a box inviting either that answered only one looked broken.
  const [filter, setFilter] = useState('');
  const [state, setState] = useState<SearchState>({ phase: 'idle' });
  // Four countries file companies per state or emirate, and the provider
  // searches ONE register at a time. Without the region it fails closed —
  // a company filed a state away would otherwise come back "not registered".
  const [regions, setRegions] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    setRegions([]);
    if (!country) return undefined;
    store
      .getState()
      .api.businessRegions(country)
      .then((r) => {
        if (!cancelled) setRegions(r.regions ?? []);
      })
      // An empty list means "do not ask" — also the safe answer when the
      // catalogue is unreachable: the search itself says so on its own.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [country, store]);

  const run = async (): Promise<void> => {
    const q = query.trim();
    if (q.length < 2) return;
    if (regions.length > 0 && !region) return;
    setState({ phase: 'searching' });
    try {
      const res = await store.getState().api.businessSearch({
        country,
        query: q,
        limit: 50,
        ...(region ? { subdivisionCode: region } : {}),
      });
      const hits = res.results ?? [];
      setFilter('');
      setState({ phase: 'results', hits, truncated: hits.length >= 50 });
    } catch {
      // Deliberately NOT an empty result list. "No matches" reads as "this
      // business is not registered", a claim an outage has not earned.
      setState({ phase: 'unavailable' });
    }
  };

  const searching = state.phase === 'searching';
  const shown =
    state.phase === 'results'
      ? state.hits.filter((h) => {
          const q = filter.trim().toLowerCase();
          if (!q) return true;
          return (
            h.name.toLowerCase().includes(q) || h.registrationNumber.toLowerCase().includes(q)
          );
        })
      : [];

  return (
    <View>
      {regions.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <MyazaText variant="label" style={{ marginBottom: spacing.sm }}>
            State or region of registration
          </MyazaText>
          <MyazaSelect
            value={region || undefined}
            sheetTitle="State or region"
            searchable
            options={regions.map((r) => ({ value: r.code, label: r.name }))}
            onChange={(code) => store.getState().setBusinessField('subdivisionCode', code)}
          />
        </View>
      )}

      {/* No label: the placeholder says it, and the magnifier says what kind
          of field this is — the web SDK's exact arrangement. */}
      <MyazaInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by company name"
        autoCorrect={false}
        prefix={<Icon name="search" size={16} color={colors.textMuted} />}
      />
      <View style={{ height: 12 }} />
      {/* The spinner lives IN the button, as on web — a separate spinner row
          pushed the results down and said the same thing twice. */}
      <MyazaButton
        label={searching ? 'Searching…' : 'Search'}
        leadingIcon={searching ? undefined : 'search'}
        loading={searching}
        onPress={() => void run()}
        disabled={searching || query.trim().length < 2 || (regions.length > 0 && !region)}
      />

      {state.phase === 'results' && state.hits.length > 0 && (
        <BusinessSearchResults
          country={country}
          hits={state.hits}
          shown={shown}
          truncated={state.truncated}
          filter={filter}
          onFilter={setFilter}
          onPicked={onPicked}
        />
      )}

      {state.phase === 'results' && state.hits.length === 0 && (
        <MyazaText variant="bodyMedium" color={colors.textSecondary} style={{ marginTop: 12 }}>
          Nothing found under that name. Try a shorter version of it, or enter the details
          yourself.
        </MyazaText>
      )}

      {state.phase === 'unavailable' && (
        <View style={{ marginTop: 12 }}>
          <MyazaAlert
            variant="warning"
            title="Search is unavailable"
            message="We could not reach the company register just now. Try again, or enter the details yourself and we will check them when you submit."
          />
        </View>
      )}

      {/* Always offered, not only on failure: some companies are not in the
          index at all, and a dead end at the first step ends the application. */}
      <Pressable
        accessibilityRole="button"
        onPress={onManualEntry}
        hitSlop={8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          marginTop: 12,
        }}
      >
        <Icon name="pencil" size={14} color={colors.textSecondary} />
        <MyazaText
          variant="bodyMedium"
          color={colors.textSecondary}
          style={{ fontWeight: '500' }}
        >
          Enter the details myself
        </MyazaText>
      </Pressable>
    </View>
  );
}
