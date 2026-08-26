import React from 'react';
import { View } from 'react-native';

import { MyazaInput } from '../components/MyazaInput';
import { spacing } from '../config/theme';
import { CompanyInfoFields } from './CompanyInfoFields';
import { isValidContactEmail } from '../config/contact';
import type { BusinessState } from '../store/state';
import type { BusinessProductDef } from '../config/business';
import type { RegistrationHint } from '../config/registrationHint';
import type { CompanyInfoField, CompanyInfoMode } from '../types/business';

// ---------------------------------------------------------------------------
// The DETAILS screen of the business step: confirming what the register said.
//
// Registration number and name are editable here too — this is also where
// manual entry lands, for the companies no search index carries. Split from
// BusinessDetailsStep (200-line rule); field order mirrors the web SDK.
// ---------------------------------------------------------------------------

export function BusinessDetailsFields({
  business,
  productDef,
  regHint,
  numberValid,
  formatOk,
  requireName,
  country,
  modes,
  showCompanyInfo,
  showContactEmail,
  onChange,
}: {
  business: BusinessState;
  productDef: BusinessProductDef;
  regHint: RegistrationHint;
  numberValid: boolean;
  formatOk: boolean;
  requireName: boolean;
  country: string;
  modes: Record<CompanyInfoField, CompanyInfoMode>;
  showCompanyInfo: boolean;
  showContactEmail: boolean;
  onChange: <K extends keyof BusinessState>(key: K, value: BusinessState[K]) => void;
}): React.ReactElement {
  const regNumber = business.registrationNumber;
  const contactEmail = business.contactEmail;
  const contactEmailInvalid =
    contactEmail.trim() !== '' && !isValidContactEmail(contactEmail.trim());
  return (
    <View>
      <MyazaInput
        label={productDef.inputLabel}
        value={regNumber}
        onChangeText={(text) => onChange('registrationNumber', text)}
        placeholder={regHint.placeholder}
        autoCapitalize="characters"
        autoCorrect={false}
        // Live like the web SDK: a wrong CAC prefix is corrected on the spot,
        // not discovered on Continue. The registry tip fills the same slot
        // until there is an error to show.
        error={
          regNumber !== '' && !numberValid
            ? (!formatOk && regHint.formatError) ||
              `Enter a valid ${productDef.inputLabel.toLowerCase()}.`
            : null
        }
        helper={regHint.tip ?? undefined}
      />

      <View style={{ height: spacing.md }} />
      <MyazaInput
        label={`Registered business name${requireName ? '' : ' (optional)'}`}
        value={business.registrationName}
        onChangeText={(text) => onChange('registrationName', text)}
        placeholder="Enter the registered business name"
        autoCorrect={false}
      />

      {showCompanyInfo ? (
        <>
          <View style={{ height: spacing.md }} />
          <CompanyInfoFields
            values={business}
            modes={modes}
            country={country}
            onChange={(field, value) => onChange(field, value)}
          />
        </>
      ) : null}

      {showContactEmail ? (
        <>
          <View style={{ height: spacing.md }} />
          <MyazaInput
            label="Contact email for owner verification (optional)"
            value={contactEmail}
            onChangeText={(text) => onChange('contactEmail', text)}
            placeholder="admin@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            helper="We'll email this address a link for your directors and owners to verify their identity."
            error={contactEmailInvalid ? 'Enter a valid email address.' : null}
          />
        </>
      ) : null}
    </View>
  );
}
