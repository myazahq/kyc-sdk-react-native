// A send-back that did not ask for the ID keeps the original one.
//
// The server carries `resubmit.idType` only on an individual, single-ID redo
// whose reviewer did not tick 'id-type'. When it does, the flow must not make
// the applicant pick the ID or supply its evidence again, and the submission
// must name the kept ID with nothing else: the server fills in the number and
// the documents from the verification being redone. Mirrors the web SDK's
// lib/resubmit.ts.
import { applyResubmitSteps, keptIdType } from '../lib/resubmit';
import { buildStepOrder, type StepOrderOptions } from '../config/stepOrder';
import { buildVerifyRequest } from '../store/submit';
import { createKycStore } from '../store/kycStore';
import type { KYCStep, ResolvedKYCConfig } from '../types/config';

jest.useFakeTimers();

const base: StepOrderOptions = {
  isBusiness: false,
  hasDocCapture: true,
  hasNfc: false,
  hasLiveness: true,
  hasCountrySelect: false,
  hasEmailVerification: false,
  hasPhoneVerification: false,
  hasPoa: false,
  hasSupportingDocuments: false,
  hasAddressCollection: false,
  hasQuestionnaire: false,
};

const opts = (o: Partial<StepOrderOptions> = {}): StepOrderOptions => ({ ...base, ...o });

describe('keptIdType', () => {
  it('returns the idType the server carried', () => {
    expect(keptIdType({ steps: ['liveness'], idType: 'bvn' })).toBe('bvn');
  });

  it('is null when the server sent none', () => {
    expect(keptIdType({ steps: ['liveness'] })).toBeNull();
    expect(keptIdType({ steps: ['liveness'], idType: null })).toBeNull();
    expect(keptIdType({ steps: ['liveness'], idType: '  ' })).toBeNull();
  });

  it('is null when the reviewer ticked the ID picker', () => {
    expect(keptIdType({ steps: ['id-type', 'liveness'], idType: 'bvn' })).toBeNull();
  });

  it('is null with no plan at all', () => {
    expect(keptIdType({ steps: [], idType: 'bvn' })).toBeNull();
    expect(keptIdType(null)).toBeNull();
    expect(keptIdType(undefined)).toBeNull();
  });
});

describe('narrowing a redo that keeps the ID', () => {
  it('walks only the frame and what was asked when no evidence was asked', () => {
    const order = buildStepOrder(opts({ resubmit: { steps: ['liveness'], idType: 'passport' } }));
    expect(order).toEqual(['consent', 'liveness', 'submitted']);
  });

  it('keeps the evidence family when evidence was asked, but not the picker', () => {
    const order = buildStepOrder(
      opts({ hasNfc: true, resubmit: { steps: ['document-capture'], idType: 'passport' } }),
    );
    expect(order).toEqual(['consent', 'document-capture', 'nfc', 'submitted']);
  });

  it('keeps the number step for a number-only kept ID', () => {
    const order = buildStepOrder(
      opts({ hasDocCapture: false, resubmit: { steps: ['id-input'], idType: 'bvn' } }),
    );
    expect(order).toEqual(['consent', 'id-input', 'submitted']);
  });

  it('still runs everything for a plan naming nothing this flow has', () => {
    const full = buildStepOrder(opts());
    expect(
      buildStepOrder(opts({ resubmit: { steps: ['future-step'], idType: 'passport' } })),
    ).toEqual(full);
    expect(buildStepOrder(opts({ resubmit: { steps: ['consent'], idType: 'passport' } }))).toEqual(
      full,
    );
  });
});

describe('narrowing without a kept ID', () => {
  it('keeps the ID steps, as before', () => {
    expect(buildStepOrder(opts({ resubmit: { steps: ['liveness'] } }))).toEqual([
      'consent',
      'id-type',
      'document-capture',
      'liveness',
      'submitted',
    ]);
  });

  it('keeps the ID steps when the reviewer ticked the picker', () => {
    expect(
      buildStepOrder(opts({ resubmit: { steps: ['id-type', 'liveness'], idType: 'passport' } })),
    ).toEqual(['consent', 'id-type', 'document-capture', 'liveness', 'submitted']);
  });
});

describe('a business redo', () => {
  const kyb: KYCStep[] = ['consent', 'business-details', 'business-documents', 'submitted'];

  it('is unchanged by an idType it should never be sent', () => {
    const withId = applyResubmitSteps(kyb, { steps: ['business-documents'], idType: 'bvn' });
    const without = applyResubmitSteps(kyb, { steps: ['business-documents'] });
    expect(withId).toEqual(without);
    expect(withId).toEqual(kyb);
  });
});

describe('the store and the submission for a kept ID', () => {
  function makeStore(resubmit: { steps: string[]; idType?: string | null }) {
    return createKycStore({
      apiKey: 'pk_test_x',
      country: 'NG',
      metadata: {},
      resubmit,
    } as unknown as ResolvedKYCConfig);
  }

  it('preselects the kept ID at flow start and after a reset', () => {
    const store = makeStore({ steps: ['liveness'], idType: 'bvn' });
    expect(store.getState().selectedIdType).toBe('bvn');
    store.getState().reset();
    expect(store.getState().selectedIdType).toBe('bvn');
  });

  it('selects nothing when the ID is not kept', () => {
    expect(makeStore({ steps: ['liveness'] }).getState().selectedIdType).toBeNull();
    expect(
      makeStore({ steps: ['id-type', 'liveness'], idType: 'bvn' }).getState().selectedIdType,
    ).toBeNull();
  });

  it('submits the kept idType with no ID number and no document media', () => {
    const store = makeStore({ steps: ['liveness'], idType: 'bvn' });
    store.setState({ mediaIds: { selfie: 'media_selfie' } });
    const request = buildVerifyRequest(store.getState(), undefined);
    expect(request.idType).toBe('bvn');
    expect(request.idNumber).toBeUndefined();
    expect(request.mediaIds?.documentFront).toBeUndefined();
    expect(request.mediaIds?.documentBack).toBeUndefined();
    expect(request.mediaIds?.selfie).toBe('media_selfie');
  });
});
