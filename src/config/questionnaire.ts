// ---------------------------------------------------------------------------
// Extra-info questionnaire — the pure half.
//
// Compliance declarations (source of funds, expected volume, PEP status …) the
// org authors in the workflow builder and the SDK asks just before submission.
// Answer keys are a published contract: they land on the verification, ride the
// webhook, and decision graphs branch on `questionnaire.<key>` — so a key must
// never be repurposed once a workflow is live.
//
// Validation lives here rather than in the screen so it can be tested without a
// renderer, and so the screen and the submission cannot disagree about what
// counts as answered. The server re-validates against the published definition
// regardless; this is for telling the user before they spend a round trip.
// ---------------------------------------------------------------------------

import type {
  QuestionnaireAnswerValue,
  QuestionnaireConfig,
  QuestionnaireField,
} from '../types/workflow';

export type QuestionnaireAnswers = Record<string, QuestionnaireAnswerValue | undefined>;

/**
 * Whether the step appears in the flow.
 *
 * `enabled: false` turns the step off while KEEPING the questions configured —
 * that is the builder's toggle, so a org can park a questionnaire without
 * losing it. Single source of truth for the gate; the step order reads it too.
 */
export function hasActiveQuestionnaire(
  questionnaire: QuestionnaireConfig | undefined | null,
): boolean {
  return questionnaire?.enabled !== false && (questionnaire?.fields?.length ?? 0) > 0;
}

/** The companion key a money answer stores its ISO currency under. */
export function currencyKeyFor(field: QuestionnaireField): string {
  return `${field.key}_currency`;
}

/** The companion key holding what an "Other" choice actually was. */
export function otherKeyFor(field: QuestionnaireField): string {
  return `${field.key}_other`;
}

/**
 * Every answer key a definition can produce — money questions contribute two,
 * and so does a choice question offering an "Other". The server uses the same
 * expansion to cross-check decision-graph references, so anything reasoning
 * about "the keys this questionnaire yields" must use it rather than mapping
 * over `fields`.
 */
export function questionnaireAnswerKeys(questionnaire: QuestionnaireConfig | undefined): string[] {
  const keys: string[] = [];
  for (const field of questionnaire?.fields ?? []) {
    keys.push(field.key);
    if (field.type === 'money') keys.push(currencyKeyFor(field));
    if ((field.options ?? []).some((o) => o.requiresDetail)) keys.push(otherKeyFor(field));
  }
  return keys;
}

function isEmpty(value: QuestionnaireAnswerValue | undefined): boolean {
  return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * Per-field error messages, keyed by field key. Empty means good to submit.
 *
 * A field that is not required and left blank is valid and simply not sent —
 * an unanswered optional question must not become an empty string on the
 * verification record.
 */
export function validateQuestionnaire(
  fields: QuestionnaireField[],
  answers: QuestionnaireAnswers,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = answers[field.key];
    if (isEmpty(value)) {
      if (field.required) errors[field.key] = 'This field is required.';
      continue;
    }

    // An "Other" choice obliges a description, whether or not the question
    // itself is required: an unexplained "Other" is the answer that most needs
    // explaining. Checked before the per-type rules so it applies to select and
    // multiselect alike.
    const detailOption = (field.options ?? []).find(
      (o) =>
        o.requiresDetail &&
        (Array.isArray(value) ? (value as string[]).includes(o.value) : value === o.value),
    );
    if (detailOption) {
      const detail = answers[`${field.key}_other`];
      if (typeof detail !== 'string' || !detail.trim()) {
        errors[field.key] = `Tell us more about "${detailOption.label}".`;
        continue;
      }
    }

    if (field.type === 'number' || field.type === 'money') {
      const num = Number(value);
      if (!Number.isFinite(num) || (field.type === 'money' && num < 0)) {
        errors[field.key] =
          field.type === 'money' ? 'Enter a valid amount.' : 'Enter a valid number.';
      } else if (field.min !== undefined && num < field.min) {
        errors[field.key] = `Must be at least ${field.min.toLocaleString()}.`;
      } else if (field.max !== undefined && num > field.max) {
        errors[field.key] = `Must be at most ${field.max.toLocaleString()}.`;
      }
      continue;
    }

    if (field.type === 'select' && field.options && field.options.length > 0) {
      if (!field.options.some((o) => o.value === value)) {
        errors[field.key] = 'Choose one of the listed options.';
      }
      continue;
    }

    if (field.type === 'multiselect' && field.options && field.options.length > 0) {
      const chosen = Array.isArray(value) ? value : [];
      if (chosen.some((v) => !field.options!.some((o) => o.value === v))) {
        errors[field.key] = 'Choose from the listed options.';
      }
    }
  }

  return errors;
}

/**
 * The answers to submit.
 *
 * Blank optional answers are dropped, numbers are sent as numbers (a numeric
 * field typed as text would break a `gt`/`lt` branch in a decision graph), and
 * money amounts are rounded to 2dp and always paired with a currency — the
 * definition's first is the default, because a user who never opened the picker
 * still meant the one that was showing.
 */
export function questionnairePayload(
  fields: QuestionnaireField[],
  answers: QuestionnaireAnswers,
): Record<string, QuestionnaireAnswerValue> {
  const payload: Record<string, QuestionnaireAnswerValue> = {};

  for (const field of fields) {
    const value = answers[field.key];
    if (isEmpty(value)) continue;

    if (field.type === 'number') {
      const num = Number(value);
      if (!Number.isFinite(num)) continue;
      payload[field.key] = num;
      continue;
    }

    if (field.type === 'money') {
      const num = Number(value);
      if (!Number.isFinite(num)) continue;
      payload[field.key] = Math.round(num * 100) / 100;
      const currency = answers[currencyKeyFor(field)] ?? field.currencies?.[0];
      if (typeof currency === 'string' && currency !== '') {
        payload[currencyKeyFor(field)] = currency;
      }
      continue;
    }

    payload[field.key] = value as QuestionnaireAnswerValue;

    // The description behind an "Other" choice. Carried explicitly for the same
    // reason `_currency` is: this builds the request from the FIELD LIST, so a
    // companion answer that is not named here is silently dropped — the user
    // types it, the client accepts it, and the server then rejects the
    // submission for a missing detail it was never sent.
    const detailOption = (field.options ?? []).find(
      (o) =>
        o.requiresDetail &&
        (Array.isArray(value) ? (value as string[]).includes(o.value) : value === o.value),
    );
    if (detailOption) {
      const detail = answers[otherKeyFor(field)];
      if (typeof detail === 'string' && detail.trim() !== '') {
        payload[otherKeyFor(field)] = detail.trim();
      }
    }
  }

  return payload;
}
