import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaInput } from '../components/MyazaInput';
import type { CompanyInfoField, CompanyInfoMode } from '../types/business';

// ---------------------------------------------------------------------------
// The company profile a KYB workflow asks for.
//
// Split from BusinessDetailsStep (200-line rule). Each field's mode comes from
// the workflow and must match the server's resolution exactly — a field marked
// optional here but required there produces a 422 the user cannot act on.
// Section header, captions and placeholders mirror the web SDK's
// BusinessCompanyInfoFields 1:1.
// ---------------------------------------------------------------------------

export const COMPANY_FIELD_LABELS: Record<CompanyInfoField, string> = {
  address: 'Registered address',
  email: 'Business email',
  phone: 'Business phone',
  website: 'Website',
};

const COMPANY_FIELD_PLACEHOLDERS: Record<CompanyInfoField, string> = {
  address: 'e.g. 12 Marina Road, Lagos',
  email: 'hello@company.com',
  phone: '+234 800 000 0000',
  website: 'company.com',
};

export function CompanyInfoFields({
  fields,
  modes,
  values,
  missing,
  showErrors,
  onChange,
}: {
  fields: CompanyInfoField[];
  modes: Record<CompanyInfoField, CompanyInfoMode>;
  values: Record<CompanyInfoField, string>;
  missing: CompanyInfoField[];
  showErrors: boolean;
  onChange: (field: CompanyInfoField, value: string) => void;
}): React.ReactElement | null {
  const { colors } = useTheme();
  if (fields.length === 0) return null;

  return (
    <>
      <View style={{ height: spacing.md }} />
      <MyazaText variant="bodyMedium" style={{ fontWeight: '600' }}>
        Company information
      </MyazaText>
      <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 2 }}>
        We verify these details against the official registry record.
      </MyazaText>
      {fields.map((field) => (
        <View key={field}>
          <View style={{ height: spacing.sm }} />
          <MyazaInput
            label={`${COMPANY_FIELD_LABELS[field]}${modes[field] === 'required' ? ' *' : ' (optional)'}`}
            value={values[field]}
            onChangeText={(text) => onChange(field, text)}
            placeholder={COMPANY_FIELD_PLACEHOLDERS[field]}
            keyboardType={
              field === 'email' ? 'email-address' : field === 'phone' ? 'phone-pad' : 'default'
            }
            autoCapitalize="none"
            error={
              showErrors && missing.includes(field)
                ? `${COMPANY_FIELD_LABELS[field]} is required.`
                : null
            }
          />
        </View>
      ))}
    </>
  );
}
