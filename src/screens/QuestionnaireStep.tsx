import React, { useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore } from '../components/runtime';
import { MyazaButton } from '../components/MyazaButton';
import { currencyKeyFor, otherKeyFor, validateQuestionnaire } from '../config/questionnaire';
import { QuestionnaireFieldView } from './QuestionnaireField';
import type { QuestionnaireAnswerValue } from '../types/workflow';

// ---------------------------------------------------------------------------
// Extra-info questionnaire — compliance declarations asked after capture and
// just before submission.
//
// Questions come from the workflow; answers ride the /verify submission and are
// re-validated server-side against the PUBLISHED definition, so what happens
// here is purely about telling the user before they spend a round trip.
//
// The step's title/description live in the sheet header (KycFlow reads them),
// matching every other step.
// ---------------------------------------------------------------------------

/** Header title/description for the questionnaire step. Used by KycFlow. */
export function questionnaireMeta(
  title: string | undefined,
  description: string | undefined,
): { title: string; description: string } {
  return {
    title: title ?? 'A few more questions',
    description:
      description ??
      'This information is required for compliance and helps keep your account safe.',
  };
}

export function QuestionnaireStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const answers = useKyc((s) => s.questionnaireAnswers);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fields = config.questionnaire?.fields ?? [];

  const setAnswer = (key: string, value: QuestionnaireAnswerValue | undefined): void => {
    store.getState().setQuestionnaireAnswer(key, value);
    // Clear this field's error as soon as it is touched — leaving it up while
    // the user is fixing it reads as though the fix didn't take.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const handleContinue = (): void => {
    const nextErrors = validateQuestionnaire(fields, answers);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    store.getState().nextStep();
  };

  return (
    <View>
      {fields.map((field) => (
        <QuestionnaireFieldView
          key={field.key}
          field={field}
          value={answers[field.key]}
          currencyValue={answers[currencyKeyFor(field)] as string | undefined}
          detailValue={answers[otherKeyFor(field)] as string | undefined}
          error={errors[field.key] || undefined}
          onChange={(value) => setAnswer(field.key, value)}
          onCurrencyChange={(currency) => setAnswer(currencyKeyFor(field), currency)}
          onDetailChange={(detail) => setAnswer(otherKeyFor(field), detail)}
        />
      ))}

      <View style={{ height: spacing.sm }} />
      <MyazaButton label="Continue" onPress={handleContinue} />
    </View>
  );
}
