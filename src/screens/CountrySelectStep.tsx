import React, { useMemo } from 'react';
import { View } from 'react-native';

import { useKyc, useKycConfig, useKycStore } from '../components/runtime';
import { CountryRegionPicker, CountryRow } from '../components/CountryRegionPicker';
import { regionCountryName } from '../config/regions';
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
    return (
      <CountryRegionPicker
        countries={options}
        selected={selected}
        geoCountry={serverConfig.geoCountry}
        onPick={pick}
      />
    );
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
