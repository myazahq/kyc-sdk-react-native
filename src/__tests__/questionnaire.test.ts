import {
  currencyKeyFor,
  hasActiveQuestionnaire,
  questionnaireAnswerKeys,
  questionnairePayload,
  validateQuestionnaire,
} from '../config/questionnaire';
import type { QuestionnaireField } from '../types/workflow';

// ─── Compliance questionnaire ─────────────────────────────────────────────────
//
// Answer keys are a PUBLISHED contract: they land on the verification, ride the
// webhook, and decision graphs branch on `questionnaire.<key>`. What that makes
// load-bearing is the SHAPE of an answer, not just its presence — a numeric
// answer sent as a string silently breaks a `gt`/`lt` branch, and a money
// amount without its currency is unusable for an AML threshold.

const field = (over: Partial<QuestionnaireField> & Pick<QuestionnaireField, 'key' | 'type'>) =>
  ({ label: over.key, ...over }) as QuestionnaireField;

describe('whether the step runs', () => {
  it('runs when questions are configured', () => {
    expect(hasActiveQuestionnaire({ fields: [field({ key: 'a', type: 'text' })] })).toBe(true);
  });

  it('does not run with no questions', () => {
    expect(hasActiveQuestionnaire({ fields: [] })).toBe(false);
    expect(hasActiveQuestionnaire(undefined)).toBe(false);
  });

  it('is switched off by `enabled: false` while keeping the questions', () => {
    // The builder's toggle parks a questionnaire without losing the authoring.
    expect(
      hasActiveQuestionnaire({ enabled: false, fields: [field({ key: 'a', type: 'text' })] }),
    ).toBe(false);
  });
});

describe('answer keys', () => {
  it('gives a money question two — the amount and its currency', () => {
    // A decision graph can branch on either, so both must be enumerable
    // without re-deriving the naming rule at each call site.
    expect(
      questionnaireAnswerKeys({
        fields: [field({ key: 'volume', type: 'money' }), field({ key: 'job', type: 'text' })],
      }),
    ).toEqual(['volume', 'volume_currency', 'job']);
  });

  it('names the companion predictably', () => {
    expect(currencyKeyFor(field({ key: 'volume', type: 'money' }))).toBe('volume_currency');
  });
});

describe('validation', () => {
  it('passes a fully answered form', () => {
    const fields = [field({ key: 'job', type: 'text', required: true })];
    expect(validateQuestionnaire(fields, { job: 'Engineer' })).toEqual({});
  });

  it('flags a missing required answer', () => {
    const fields = [field({ key: 'job', type: 'text', required: true })];
    expect(validateQuestionnaire(fields, {})).toHaveProperty('job');
  });

  it('treats an empty string and an empty list as unanswered', () => {
    const fields = [
      field({ key: 'job', type: 'text', required: true }),
      field({ key: 'kinds', type: 'multiselect', required: true }),
    ];
    const errors = validateQuestionnaire(fields, { job: '', kinds: [] });
    expect(Object.keys(errors).sort()).toEqual(['job', 'kinds']);
  });

  it('leaves an unanswered OPTIONAL question alone', () => {
    const fields = [field({ key: 'job', type: 'text' })];
    expect(validateQuestionnaire(fields, {})).toEqual({});
  });

  it('rejects a number that is not one', () => {
    const fields = [field({ key: 'n', type: 'number' })];
    expect(validateQuestionnaire(fields, { n: 'twelve' })).toHaveProperty('n');
  });

  it('enforces min and max', () => {
    const fields = [field({ key: 'n', type: 'number', min: 10, max: 20 })];
    expect(validateQuestionnaire(fields, { n: '9' })).toHaveProperty('n');
    expect(validateQuestionnaire(fields, { n: '21' })).toHaveProperty('n');
    expect(validateQuestionnaire(fields, { n: '15' })).toEqual({});
  });

  it('rejects a negative amount', () => {
    const fields = [field({ key: 'amt', type: 'money', currencies: ['NGN'] })];
    expect(validateQuestionnaire(fields, { amt: '-1' })).toHaveProperty('amt');
  });

  it('rejects a choice that is not on offer', () => {
    // The options are the contract the server validates against, so an answer
    // outside them is a guaranteed 422 — better caught before the round trip.
    const fields = [
      field({ key: 'src', type: 'select', options: [{ value: 'salary', label: 'Salary' }] }),
    ];
    expect(validateQuestionnaire(fields, { src: 'other' })).toHaveProperty('src');
    expect(validateQuestionnaire(fields, { src: 'salary' })).toEqual({});
  });

  it('rejects a multiselect containing an option that is not on offer', () => {
    const fields = [
      field({
        key: 'kinds',
        type: 'multiselect',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      }),
    ];
    expect(validateQuestionnaire(fields, { kinds: ['a', 'z'] })).toHaveProperty('kinds');
    expect(validateQuestionnaire(fields, { kinds: ['a', 'b'] })).toEqual({});
  });
});

describe('the submitted payload', () => {
  it('sends numbers as numbers', () => {
    // A `gt`/`lt` branch in a decision graph compares numerically; a string
    // here fails closed and the workflow silently takes the wrong path.
    const fields = [field({ key: 'n', type: 'number' })];
    expect(questionnairePayload(fields, { n: '42' })).toEqual({ n: 42 });
  });

  it('rounds money to two decimals', () => {
    const fields = [field({ key: 'amt', type: 'money', currencies: ['NGN'] })];
    expect(questionnairePayload(fields, { amt: '1000.555' })).toEqual({
      amt: 1000.56,
      amt_currency: 'NGN',
    });
  });

  it("defaults a money answer's currency to the first offered", () => {
    // The first currency is the one the field was SHOWING, so a user who never
    // opened the picker still meant it.
    const fields = [field({ key: 'amt', type: 'money', currencies: ['NGN', 'USD'] })];
    expect(questionnairePayload(fields, { amt: '500' }).amt_currency).toBe('NGN');
  });

  it('keeps a currency the user actually chose', () => {
    const fields = [field({ key: 'amt', type: 'money', currencies: ['NGN', 'USD'] })];
    expect(questionnairePayload(fields, { amt: '500', amt_currency: 'USD' }).amt_currency).toBe(
      'USD',
    );
  });

  it('omits blank optional answers rather than sending empties', () => {
    // An unanswered question must be absent from the record, not present as an
    // empty string — the two mean different things to a reviewer.
    const fields = [
      field({ key: 'job', type: 'text' }),
      field({ key: 'kinds', type: 'multiselect' }),
    ];
    expect(questionnairePayload(fields, { job: '', kinds: [] })).toEqual({});
  });

  it('sends only what the definition asks for', () => {
    // Answers left over from an edited workflow must not leak onto the record.
    const fields = [field({ key: 'job', type: 'text' })];
    expect(questionnairePayload(fields, { job: 'Engineer', removed_question: 'x' })).toEqual({
      job: 'Engineer',
    });
  });

  it('keeps booleans and lists as they are', () => {
    const fields = [
      field({ key: 'pep', type: 'boolean' }),
      field({ key: 'kinds', type: 'multiselect' }),
    ];
    expect(questionnairePayload(fields, { pep: false, kinds: ['a', 'b'] })).toEqual({
      pep: false,
      kinds: ['a', 'b'],
    });
  });
});
