import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MyazaInput } from '../components/MyazaInput';
import { MyazaSelect } from '../components/MyazaSelect';
import { CountryField } from '../components/CountryField';
import { CompanyInfoFields } from './CompanyInfoFields';
import {
  businessCountriesFor,
  businessCountryName,
  businessProductsForCountry,
  companyInfoFieldModes,
  getBusinessProductDef,
  keyPeopleNeedsContactEmail,
  missingRequiredCompanyInfo,
} from '../config/business';
import { registrationNumberHint } from '../config/registrationHint';
import { isValidContactEmail } from '../config/contact';
import type { CompanyInfoField } from '../types/business';

// ---------------------------------------------------------------------------
// Business (KYB) registry details.
//
// The registry lookup verifies that a business EXISTS. Registration numbers are
// public, so it proves nothing about who is filling this in — that is what the
// rest of the KYB application (key people, documents, the applicant's own KYC)
// is for. This step collects the number, the registry country and product, and
// the company profile the workflow asks for.
// ---------------------------------------------------------------------------

export const businessDetailsMeta = {
  title: 'Business Details',
  description:
    'Provide your business registration details for verification against the official registry.',
};

export function BusinessDetailsStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const { colors } = useTheme();
  const business = useKyc((s) => s.business);
  const [touched, setTouched] = useState(false);

  const workflowBusiness = config.business;
  const countries = useMemo(() => businessCountriesFor(workflowBusiness), [workflowBusiness]);
  // Precedence mirrors the web SDK exactly: the visitor's pick, then the
  // workflow's PRIMARY country, then the list head. The primary is always in
  // the offered list but not necessarily FIRST — preferring `countries[0]`
  // defaulted the picker to the wrong registry whenever the primary sat later.
  const country = business.country ?? workflowBusiness?.country ?? countries[0] ?? '';
  const products = useMemo(
    () => businessProductsForCountry(workflowBusiness, country),
    [workflowBusiness, country],
  );
  // Re-derived per country rather than remembered: a product the picked country
  // does not offer would be rejected at submit.
  const product = products.includes(business.product ?? '') ? business.product! : products[0]!;
  const productDef = getBusinessProductDef(product);

  const modes = companyInfoFieldModes(workflowBusiness);
  const companyFields = (Object.keys(modes) as CompanyInfoField[]).filter(
    (field) => modes[field] !== 'off',
  );
  const needsContactEmail = keyPeopleNeedsContactEmail(workflowBusiness);

  const set = <K extends keyof typeof business>(key: K, value: (typeof business)[K]): void =>
    store.getState().setBusinessField(key, value);

  const missingCompanyInfo = missingRequiredCompanyInfo(workflowBusiness, {
    address: business.address,
    email: business.email,
    phone: business.phone,
    website: business.website,
  });
  const contactEmailInvalid =
    needsContactEmail && business.contactEmail.trim() !== '' && !isValidContactEmail(business.contactEmail);
  const nameMissing =
    workflowBusiness?.requireRegistrationName === true && business.registrationName.trim() === '';

  // Country-aware registration-number guidance (NG: CAC prefix rules + format
  // validation; elsewhere: placeholder + registry tip). Mirrors the web SDK.
  const regHint = registrationNumberHint(country, productDef);
  const regNumber = business.registrationNumber;
  const formatOk =
    !regHint.isValidFormat || regNumber.trim() === '' || regHint.isValidFormat(regNumber);
  const numberValid = regNumber.trim().length >= 2 && formatOk;
  const canContinue =
    numberValid && !nameMissing && missingCompanyInfo.length === 0 && !contactEmailInvalid;

  const handleContinue = (): void => {
    setTouched(true);
    if (!canContinue) return;
    // Persist the resolved country/product so the submission uses exactly what
    // was on screen, not a re-derivation from a config that may have changed.
    set('country', country);
    set('product', product);
    store.getState().nextStep();
  };

  return (
    <View>
      {countries.length > 1 ? (
        <>
          <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
            Country of registration
          </MyazaText>
          {/* The SAME sheet as the phone field's dial-code picker — restricted
              to the workflow's registry countries. */}
          <CountryField
            value={country}
            options={countries.map((code) => ({ code, name: businessCountryName(code) }))}
            onChange={(code) => {
              set('country', code);
              // The product list narrows per country, so a stale pick is
              // cleared rather than carried into a refused submission.
              set('product', null);
            }}
          />
          <View style={{ height: spacing.md }} />
        </>
      ) : null}

      {products.length > 1 ? (
        <>
          <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
            Verification type
          </MyazaText>
          <MyazaSelect
            value={product}
            sheetTitle="Verification type"
            options={products.map((key) => ({
              value: key,
              label: getBusinessProductDef(key).label,
            }))}
            onChange={(key) => set('product', key)}
          />
          <View style={{ height: spacing.md }} />
        </>
      ) : null}

      <MyazaInput
        label={productDef.inputLabel}
        value={business.registrationNumber}
        onChangeText={(text) => set('registrationNumber', text)}
        placeholder={regHint.placeholder}
        autoCapitalize="characters"
        autoFocus
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

      <View style={{ height: spacing.sm }} />
      <MyazaInput
        label={`Registered business name${workflowBusiness?.requireRegistrationName ? '' : ' (optional)'}`}
        value={business.registrationName}
        onChangeText={(text) => set('registrationName', text)}
        placeholder="Enter the registered business name"
        error={touched && nameMissing ? 'Enter the registered business name.' : null}
      />

      <CompanyInfoFields
        fields={companyFields}
        modes={modes}
        values={{
          address: business.address,
          email: business.email,
          phone: business.phone,
          website: business.website,
        }}
        missing={missingCompanyInfo}
        showErrors={touched}
        onChange={(field, text) => set(field, text)}
      />

      {needsContactEmail ? (
        <>
          <View style={{ height: spacing.sm }} />
          <MyazaInput
            label="Contact email for owner verification (optional)"
            value={business.contactEmail}
            onChangeText={(text) => set('contactEmail', text)}
            placeholder="admin@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            helper="We'll email this address a link for your directors and owners to verify their identity."
            error={touched && contactEmailInvalid ? 'Enter a valid email address.' : null}
          />
        </>
      ) : null}

      <View style={{ height: spacing.md }} />
      <MyazaButton label="Continue" onPress={handleContinue} disabled={touched && !canContinue} />
      {touched && !canContinue ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.xs, textAlign: 'center' }}>
          Please complete the highlighted fields.
        </MyazaText>
      ) : null}
    </View>
  );
}
