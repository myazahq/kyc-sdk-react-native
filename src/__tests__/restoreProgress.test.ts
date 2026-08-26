import { restoreAttemptProgress } from '../store/session';
import { createKycStore } from '../store/kycStore';
import type { ResolvedKYCConfig } from '../types/config';

// A resumed session's stored progress hydrates the store — the RN mirror of
// web's RESTORE_PROGRESS. The snapshot is our own SDK's write, but an OLD
// snapshot (pre-sectioned key people) must normalize rather than break.

function makeStore() {
  return createKycStore({
    apiKey: 'pk_test_x',
    country: 'NG',
    metadata: {},
  } as unknown as ResolvedKYCConfig);
}

// The store wires a debounced progress watcher; fake timers keep its 800ms
// timeout from holding jest open after the assertions are done.
jest.useFakeTimers();

describe('restoreAttemptProgress', () => {
  it('restores step, captures and typed data', () => {
    const store = makeStore();
    restoreAttemptProgress(store, {
      step: 'id-input',
      mediaIds: { documentFront: 'med_1' },
      data: {
        selectedCountry: 'NG',
        selectedIdType: 'bvn',
        idNumber: '12345678901',
        questionnaireAnswers: { source_of_funds: 'salary' },
      },
    });
    const s = store.getState();
    expect(s.currentStep).toBe('id-input');
    expect(s.mediaIds.documentFront).toBe('med_1');
    expect(s.selectedCountry).toBe('NG');
    expect(s.selectedIdType).toBe('bvn');
    expect(s.idNumber).toBe('12345678901');
    expect(s.questionnaireAnswers['source_of_funds']).toBe('salary');
  });

  it('normalizes key-people rows saved before the sectioned redesign', () => {
    const store = makeStore();
    restoreAttemptProgress(store, {
      step: 'business-key-people',
      data: {
        businessApplication: {
          keyPeople: [{ name: 'Bola Owner', role: 'beneficial_owner', ownershipPct: '60' }],
          applicantRole: 'director',
          applicantName: 'Jane',
        },
      },
    });
    const app = store.getState().businessApplication;
    expect(app.applicantRole).toBe('director');
    expect(app.keyPeople).toHaveLength(1);
    const row = app.keyPeople[0]!;
    // The old row had no roles/title/owners — the restore supplies the shape
    // the sectioned cards read.
    expect(row.roles).toEqual(['beneficial_owner']);
    expect(row.title).toBe('');
    expect(row.owners).toEqual([]);
    expect(row.isCorporate).toBe(false);
  });

  it('leaves untouched fields at their launch values', () => {
    const store = makeStore();
    const before = store.getState();
    restoreAttemptProgress(store, { step: 'consent' });
    const after = store.getState();
    expect(after.selectedCountry).toBe(before.selectedCountry);
    expect(after.businessApplication).toEqual(before.businessApplication);
  });

  it('never resumes onto a failed submission', () => {
    // A 422 still writes `submitted` as the last step reached, so reopening
    // resumed there, submitted again, failed the same way and wrote it again.
    const store = makeStore();
    const before = store.getState().currentStep;
    restoreAttemptProgress(store, { step: 'submitted', data: {} } as never);
    expect(store.getState().currentStep).not.toBe('submitted');
    expect(store.getState().currentStep).toBe(before);
  });
});