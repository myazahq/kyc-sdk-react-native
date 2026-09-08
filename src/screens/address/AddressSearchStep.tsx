import React, { useEffect } from 'react';
import { View } from 'react-native';

import { spacing } from '../../config/theme';
import { useKyc, useKycStore, useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { pickedAddressState } from '../../lib/address-helpers';
import { useAddressFlow } from './use-address-flow';
import { useAddressIntroGate } from './AddressIntroGate';
import { SearchScreen } from './SearchScreen';
import { SkipForNow } from './SkipForNow';

/**
 * Step 1 of the address flow: find the address as words. Every path — a picked
 * suggestion, the current location, or "place a pin instead" — lands on the pin
 * step.
 */
export function AddressSearchStep(): React.ReactElement {
  const store = useKycStore();
  const { colors } = useTheme();
  const flow = useAddressFlow();
  const autocomplete = useKyc((s) => s.serverConfig.addressSearchMode === 'autocomplete');
  const gate = useAddressIntroGate('address-search', flow.steps[0]!);

  // Warm the GPS and its reverse geocode from the moment the flow is reached,
  // UNDER the primer too: by the time "Got it" is tapped the fix is usually
  // already resolved, so the row carries the address immediately and the pin
  // lands with no hesitation.
  const { startPrefetch } = flow;
  useEffect(() => {
    startPrefetch();
  }, [startPrefetch]);

  if (gate) return gate;

  const toPin = (): void => store.getState().goToStep('address-collection');

  return (
    <View>
      <SearchScreen
        country={flow.country}
        autocomplete={autocomplete}
        near={flow.currentFix ? { lat: flow.currentFix.lat, lng: flow.currentFix.lng } : null}
        locationHint={flow.currentFix?.label ?? null}
        locating={flow.locating}
        onUseMyLocation={() => void flow.applyCurrentFix(toPin)}
        onPinInstead={toPin}
        onResolved={(hit) => {
          // The picked address's own country IS the declaration (a pick is
          // the applicant saying "this is my address"), under the same
          // guess-only / accepted-list rules as every geocode adoption.
          flow.adoptGeocodedCountry(hit.country, { explicit: true });
          const current = store.getState().address;
          store.getState().setAddress({
            ...pickedAddressState(current, hit),
            // `pickedAt` is what makes this a HUMAN-CONFIRMED label: it
            // survives pin nudges instead of being re-derived on every drag.
            // Never set it from a reverse geocode.
            ...(hit.formatted
              ? { label: hit.formatted, pickedAt: { lat: hit.lat, lng: hit.lng } }
              : {}),
            // A pick that RESOLVES a street retires the typed one: that input
            // only existed because no source knew the street, and a hidden
            // field must not keep leading the composed line.
            ...(hit.road ? { street: undefined } : {}),
            // Places picks carry the breakdown; basic hits fall back to the
            // label line in the details sheet.
            ...(hit.road || hit.area || hit.city || hit.state || hit.postcode || hit.country
              ? {
                  parts: {
                    street: hit.road ?? null,
                    area: hit.area ?? null,
                    city: hit.city ?? null,
                    state: hit.state ?? null,
                    postcode: hit.postcode ?? null,
                    country: hit.country ?? null,
                  },
                }
              : {}),
          });
          toPin();
        }}
      />

      {flow.error ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.sm }}>
          {flow.error}
        </MyazaText>
      ) : null}

      <SkipForNow requirePin={flow.cfg?.requirePin} onPress={flow.exitForward} />
    </View>
  );
}
