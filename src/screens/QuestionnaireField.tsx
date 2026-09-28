import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaDateField } from '../components/MyazaDateField';
import { MyazaInput } from '../components/MyazaInput';
import { MyazaSelect } from '../components/MyazaSelect';
import { OptionRow } from '../components/OptionRow';
import { MoneyField as QuestionnaireMoneyField } from './QuestionnaireMoneyField';
import { QuestionnaireBooleanField } from './QuestionnaireBooleanField';
import { useText } from '../i18n/useText';
import { currencyKeyFor } from '../config/questionnaire';
import type { QuestionnaireAnswerValue, QuestionnaireField as FieldDef } from '../types/workflow';

// ---------------------------------------------------------------------------
// One questionnaire question.
//
// Mirrors the Flutter SDK field-for-field, because a questionnaire is authored
// once and rendered on every platform — a question that looks like a different
// control per platform reads as a different question:
//
//   label        the question, with a RED * when required (not "(optional)" on
//                the ones that aren't — most questions are required, so marking
//                the exception is quieter than marking the rule)
//   select       a select field that opens a sheet
//   multiselect  tappable cards with square checks (the choices are the point)
//   boolean      two centred Yes / No cards
//   money        amount + currency on ONE row
//   text/number  a plain input
// ---------------------------------------------------------------------------

export function QuestionnaireFieldView({
  field,
  value,
  currencyValue,
  detailValue,
  error,
  onChange,
  onCurrencyChange,
  onDetailChange,
}: {
  field: FieldDef;
  value: QuestionnaireAnswerValue | undefined;
  /** money only: the `<key>_currency` companion answer. */
  currencyValue?: string;
  /** choice fields only: the `<key>_other` companion answer. */
  detailValue?: string;
  error?: string;
  onChange: (value: QuestionnaireAnswerValue | undefined) => void;
  onCurrencyChange: (currency: string) => void;
  onDetailChange?: (detail: string | undefined) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const t = useText();

  const isPlainInput = field.type === 'text' || field.type === 'number';

  // The chosen option that is not an answer on its own ("Other"). Covers both
  // select (a single value) and multiselect (a list).
  const detailOption = (field.options ?? []).find(
    (o) =>
      o.requiresDetail &&
      (Array.isArray(value) ? value.includes(o.value) : value === o.value),
  );

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <FieldLabel
        text={field.label}
        required={field.required === true}
        helpText={
          field.helpText ??
          (field.type === 'multiselect' ? 'Choose all that apply.' : undefined)
        }
      />

      {isPlainInput ? (
        <MyazaInput
          value={value === undefined ? '' : String(value)}
          onChangeText={(text) => onChange(text === '' ? undefined : text)}
          placeholder={field.placeholder}
          error={error ?? null}
          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
          autoCapitalize="none"
        />
      ) : null}

      {field.type === 'date' ? (
        // A real calendar, not a "type YYYY-MM-DD" text box — same picker
        // contract as the Flutter SDK's _DateField / showMyazaDatePicker.
        <MyazaDateField
          value={typeof value === 'string' ? value : undefined}
          onChange={(iso) => onChange(iso)}
          placeholder={field.placeholder}
          error={error ?? null}
        />
      ) : null}

      {field.type === 'money' ? (
        <QuestionnaireMoneyField
          field={field}
          value={value}
          currencyValue={currencyValue}
          error={error}
          onChange={onChange}
          onCurrencyChange={onCurrencyChange}
        />
      ) : null}

      {field.type === 'boolean' ? <QuestionnaireBooleanField value={value} onChange={onChange} /> : null}

      {field.type === 'select' ? (
        <MyazaSelect<string>
          value={typeof value === 'string' ? value : null}
          hint={field.placeholder ?? 'Select an option'}
          sheetTitle={field.label}
          options={(field.options ?? []).map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(next) => onChange(next)}
        />
      ) : null}

      {field.type === 'multiselect'
        ? (field.options ?? []).map((option) => {
            const selected = Array.isArray(value) && value.includes(option.value);
            return (
              <OptionRow
                key={option.value}
                label={option.label}
                selected={selected}
                multi
                onPress={() => {
                  const current = Array.isArray(value) ? value : [];
                  const next = selected
                    ? current.filter((v) => v !== option.value)
                    : [...current, option.value];
                  onChange(next.length > 0 ? next : undefined);
                }}
              />
            );
          })
        : null}

      {/* Free text behind an "Other" choice. Always required once that option
          is picked: an unexplained "Other" is the answer a compliance reviewer
          most needs spelled out. */}
      {detailOption ? (
        <View style={{ marginTop: spacing.sm }}>
          <MyazaInput
            label={detailOption.detailLabel || t('questionnaire.detailLabel')}
            value={detailValue ?? ''}
            maxLength={200}
            placeholder={
              detailOption.detailPlaceholder || `Tell us more about "${detailOption.label}"`
            }
            onChangeText={(text: string) => onDetailChange?.(text || undefined)}
          />
        </View>
      ) : null}

      {/* Inputs draw their own error; the rest need one underneath. */}
      {error && !isPlainInput && field.type !== 'money' ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.xs }}>
          {error}
        </MyazaText>
      ) : null}
    </View>
  );
}

function FieldLabel({
  text,
  required,
  helpText,
}: {
  text: string;
  required: boolean;
  helpText?: string;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.xs }}>
      <MyazaText variant="body" style={{ fontWeight: '600' }}>
        {text}
        {required ? <MyazaText color={colors.error}> *</MyazaText> : null}
      </MyazaText>
      {helpText ? (
        <MyazaText variant="bodySmall" color={colors.textSecondary}>
          {helpText}
        </MyazaText>
      ) : null}
    </View>
  );
}

export { currencyKeyFor };
