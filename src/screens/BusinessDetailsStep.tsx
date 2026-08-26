import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore } from '../components/runtime';
import { MyazaButton } from '../components/MyazaButton';
import { BusinessRegistryPickers } from './BusinessRegistryPickers';
import { BusinessSearch } from './BusinessSearch';
import { BusinessPickedSection } from './BusinessPickedSection';
import { BusinessDetailsFields } from './BusinessDetailsFields';
import { BusinessCheckPanel } from './BusinessCheckPanel';
import {
  businessCountriesFor,
  businessProductsForCountry,
  companyInfoFieldModes,
  getBusinessProductDef,
  keyPeopleNeedsContactEmail,
} from '../config/business';
import { registrationNumberHint } from '../config/registrationHint';
import { registerPrefillPatch } from '../config/businessPrefill';
import { businessDetailsValid, checkPanelVisible } from '../config/businessDetailsValidity';

// ---------------------------------------------------------------------------
// Business (KYB) registry details — two screens in one step.
//
// 'pick' is choosing WHICH company. 'details' is confirming what the register
// then said about it. They are separate because the register has not been
// asked yet while you are still picking, so showing the detail fields there
// would invite somebody to fill in answers we are about to overwrite.
// Continue is what runs the paid check and moves between them. Mirrors the
// web SDK's BusinessDetailsStep — keep the two in lockstep.
// ---------------------------------------------------------------------------

export const businessDetailsMeta = {
  title: 'Business Details',
  description:
    'Provide your business registration details for verification against the official registry.',
};

export function BusinessDetailsStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const business = useKyc((s) => s.business);
  const check = useKyc((s) => s.businessCheck);
  const [phase, setPhase] = useState<'pick' | 'details'>('pick');
  // Production never shows the test-result toggle, and never honours a pin.
  const isSandbox = useKyc((s) => s.serverConfig.environment) !== 'PRODUCTION';

  const workflowBusiness = config.business;
  const countries = useMemo(() => businessCountriesFor(workflowBusiness), [workflowBusiness]);
  // Precedence mirrors the web SDK: the visitor's pick, then the workflow's
  // PRIMARY country, then the list head.
  const country = business.country ?? workflowBusiness?.country ?? countries[0] ?? '';
  const products = useMemo(
    () => businessProductsForCountry(workflowBusiness, country),
    [workflowBusiness, country],
  );
  const product = products.includes(business.product ?? '') ? business.product! : products[0]!;
  const productDef = getBusinessProductDef(product);

  const modes = companyInfoFieldModes(workflowBusiness);
  const showCompanyInfo = Object.values(modes).some((m) => m !== 'off');
  const showContactEmail = keyPeopleNeedsContactEmail(workflowBusiness);

  const set = <K extends keyof typeof business>(key: K, value: (typeof business)[K]): void =>
    store.getState().setBusinessField(key, value);

  const regHint = registrationNumberHint(country, productDef);
  const regNumber = business.registrationNumber;
  // A company has been named, so the card replaces the search. The NUMBER is
  // what names it (a prefilled session sends one without a name; the register
  // supplies the name on Continue, so an unnamed card is momentary).
  const picked = regNumber.trim() !== '';
  const nameRequired = workflowBusiness?.requireRegistrationName === true;
  const formatOk =
    !regHint.isValidFormat || regNumber.trim() === '' || regHint.isValidFormat(regNumber);
  const numberValid = regNumber.trim().length >= 2 && formatOk;

  const isFormValid = businessDetailsValid({
    phase,
    business,
    modes,
    product,
    numberValid,
    nameRequired,
    showContactEmail,
  });

  const checking = check.status === 'checking';

  const handleContinue = async (): Promise<void> => {
    if (!isFormValid || checking) return;
    // Persist the resolved country/product so the submission uses exactly what
    // was on screen. Only when different: these are identity keys, and writing
    // an unchanged value would needlessly reset the check we just ran.
    if (business.country !== country) set('country', country);
    if (business.product !== product) set('product', product);

    // The paid registry check — awaited, so the details screen opens already
    // holding what the register said. Only a definitive "not on the register"
    // stops the flow: everything else (a short balance, an outage) continues
    // and is checked at submission, as it was before.
    const { canContinue, company } = await store.getState().checkBusiness();
    if (!canContinue) return;

    // First Continue ends at the details screen rather than the next step: the
    // register has only just answered, and this is where what it said gets put
    // in front of them to confirm or correct.
    if (phase === 'pick') {
      const { patch, prefilled } = registerPrefillPatch(company, store.getState().business);
      if (prefilled.length > 0) store.getState().applyBusinessPrefill(patch, prefilled);
      setPhase('details');
      return;
    }
    store.getState().nextStep();
  };

  return (
    <View>
      <BusinessRegistryPickers
        country={country}
        countries={countries}
        product={product}
        products={products}
        onCountry={(code) => {
          set('country', code);
          // The product list narrows per country, so a stale pick is cleared
          // rather than carried into a refused submission.
          set('product', null);
        }}
        onProduct={(key) => set('product', key)}
      />

      {/* HIDDEN, not unmounted, once a company is chosen: unmounting threw
          away the query and results, so "Change" dropped somebody back to an
          empty box. Hiding keeps the picker alive, which makes Change cheap. */}
      <View style={{ display: phase === 'pick' && country && !picked ? 'flex' : 'none' }}>
        <BusinessSearch
          country={country}
          onPicked={(hit) => {
            // Names the company and nothing more: the register is asked on
            // Continue, and the fields it fills live on the screen after.
            set('registrationNumber', hit.registrationNumber);
            set('registrationName', hit.name);
          }}
          onManualEntry={() => setPhase('details')}
        />
      </View>

      {phase === 'pick' && picked ? (
        <BusinessPickedSection
          country={country}
          name={business.registrationName}
          registrationNumber={regNumber}
          isSandbox={isSandbox}
          onChange={() => {
            // Back to the search rather than an undo: they are changing WHICH
            // company this is about, and the fields belong to the old one.
            set('registrationNumber', '');
            set('registrationName', '');
          }}
        />
      ) : null}

      {phase === 'details' ? (
        <BusinessDetailsFields
          business={business}
          productDef={productDef}
          regHint={regHint}
          numberValid={numberValid}
          formatOk={formatOk}
          requireName={nameRequired}
          country={country}
          modes={modes}
          showCompanyInfo={showCompanyInfo}
          showContactEmail={showContactEmail}
          onChange={set}
        />
      ) : null}

      {checkPanelVisible(check.status) ? (
        <>
          <View style={{ height: spacing.lg }} />
          <BusinessCheckPanel check={check} />
        </>
      ) : null}

      <View style={{ height: spacing.lg }} />
      <MyazaButton
        label={checking ? 'Checking…' : phase === 'details' ? 'Confirm details & continue' : 'Continue'}
        onPress={() => void handleContinue()}
        loading={checking}
        disabled={!isFormValid || checking}
      />
    </View>
  );
}

