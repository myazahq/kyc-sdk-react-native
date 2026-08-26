import React from 'react';
import { View } from 'react-native';

import { CountryField } from '../components/CountryField';
import { MyazaSelect } from '../components/MyazaSelect';
import { MyazaText } from '../components/Typography';
import { businessCountryName, getBusinessProductDef } from '../config/business';
import { spacing } from '../config/theme';

// The registry pickers: which country's register, and which product to run
// against it. Rendered only when there is a choice to make. Split from
// BusinessDetailsStep (200-line rule).

export function BusinessRegistryPickers({
  country,
  countries,
  product,
  products,
  onCountry,
  onProduct,
}: {
  country: string;
  countries: string[];
  product: string;
  products: string[];
  onCountry: (code: string) => void;
  onProduct: (key: string) => void;
}): React.ReactElement {
  return (
    <>
      {countries.length > 1 ? (
        <>
          <MyazaText variant="label" style={{ marginBottom: spacing.sm }}>
            Country of registration
          </MyazaText>
          {/* The SAME sheet as the phone field's dial-code picker — restricted
              to the workflow's registry countries. */}
          <CountryField
            value={country}
            options={countries.map((code) => ({ code, name: businessCountryName(code) }))}
            onChange={onCountry}
          />
          <View style={{ height: spacing.lg }} />
        </>
      ) : null}

      {products.length > 1 ? (
        <>
          <MyazaText variant="label" style={{ marginBottom: spacing.sm }}>
            Verification type
          </MyazaText>
          <MyazaSelect
            value={product}
            sheetTitle="Verification type"
            options={products.map((key) => ({
              value: key,
              label: getBusinessProductDef(key).label,
            }))}
            onChange={onProduct}
          />
          <View style={{ height: spacing.lg }} />
        </>
      ) : null}

    </>
  );
}
