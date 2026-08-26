import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaInput } from '../components/MyazaInput';
import { MyazaDateField } from '../components/MyazaDateField';
import { PhoneNumberInput } from '../components/PhoneNumberInput';
import { isValidContactEmail } from '../config/contact';
import { isValidWebsite } from '../config/website';
import type { CompanyInfoField, CompanyInfoMode } from '../types/business';
import type { BusinessState } from '../store/state';

// ---------------------------------------------------------------------------
// The company profile a KYB workflow asks for.
//
// Split from BusinessDetailsStep (200-line rule). Each field's mode comes from
// the workflow and must match the server's resolution exactly — a field marked
// optional here but required there produces a 422 the user cannot act on. The
// last five are registry facts the applicant STATES: asked as their own answer
// rather than filled from the register, because where the two differ that is
// the finding. Field list, labels, placeholders and controls mirror the web
// SDK's BusinessCompanyInfoFields 1:1.
// ---------------------------------------------------------------------------

const FIELD_DEFS: Array<{
  key: CompanyInfoField;
  label: string;
  placeholder: string;
  kind?: 'phone' | 'date' | 'email' | 'website';
}> = [
  { key: 'address', label: 'Registered address', placeholder: 'e.g. 12 Marina Road, Lagos' },
  { key: 'email', label: 'Business email', placeholder: 'hello@company.com', kind: 'email' },
  { key: 'phone', label: 'Business phone', placeholder: '+234 800 000 0000', kind: 'phone' },
  { key: 'website', label: 'Website', placeholder: 'company.com', kind: 'website' },
  { key: 'dateOfIncorporation', label: 'Date of incorporation', placeholder: 'YYYY-MM-DD', kind: 'date' },
  { key: 'taxId', label: 'Tax ID', placeholder: 'e.g. 01234567-0001' },
  { key: 'vatNumber', label: 'VAT number', placeholder: 'e.g. NG123456789' },
  { key: 'companyType', label: 'Company type', placeholder: 'e.g. Private Limited Company' },
  { key: 'natureOfBusiness', label: 'Nature of business', placeholder: 'What the company does' },
];

export function CompanyInfoFields({
  values,
  modes,
  country,
  onChange,
}: {
  values: BusinessState;
  modes: Record<CompanyInfoField, CompanyInfoMode>;
  /** Seeds the phone dial code: the company's country of registration. */
  country?: string;
  onChange: (field: CompanyInfoField, value: string) => void;
}): React.ReactElement | null {
  const { colors } = useTheme();
  const visible = FIELD_DEFS.filter((f) => modes[f.key] !== 'off');
  if (visible.length === 0) return null;

  return (
    <View>
      <MyazaText variant="label">Company information</MyazaText>
      <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 2 }}>
        We verify these details against the official registry record.
      </MyazaText>
      {visible.map((f) => {
        const required = modes[f.key] === 'required';
        const value = values[f.key];
        const error =
          f.kind === 'email' && value !== '' && !isValidContactEmail(value)
            ? 'Enter a valid email address.'
            : f.kind === 'website' && value !== '' && !isValidWebsite(value)
              ? 'Enter a valid website, for example company.com'
              : null;
        return (
          <View key={f.key} style={{ marginTop: spacing.md }}>
            {f.kind === 'phone' || f.kind === 'date' ? (
              <MyazaText variant="label" style={{ marginBottom: spacing.sm }}>
                {f.label}
                {required ? ' *' : ' (optional)'}
              </MyazaText>
            ) : null}
            {f.kind === 'phone' ? (
              // The same control the phone-verification step uses: dial-code
              // picker, as-you-type national formatting, E.164 out. A business
              // number is a phone number, and a bare text box gets back a dozen
              // different shapes of the same digits. `value` carries the
              // register's number when the lookup returned one.
              <PhoneNumberInput
                value={value}
                defaultCountry={country}
                onChange={({ e164 }) => onChange('phone', e164)}
              />
            ) : f.kind === 'date' ? (
              // A date gets the picker, not a text box — same control the
              // questionnaire uses; emits strict YYYY-MM-DD.
              <MyazaDateField
                value={value || undefined}
                placeholder={f.placeholder}
                onChange={(iso) => onChange(f.key, iso)}
              />
            ) : (
              <MyazaInput
                label={`${f.label}${required ? ' *' : ' (optional)'}`}
                value={value}
                onChangeText={(text) => onChange(f.key, text)}
                placeholder={f.placeholder}
                keyboardType={f.kind === 'email' ? 'email-address' : 'default'}
                autoCapitalize={f.kind === 'email' || f.kind === 'website' ? 'none' : 'words'}
                error={error}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
