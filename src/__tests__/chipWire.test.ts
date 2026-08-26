// What the chip read actually PUTS ON THE WIRE.
//
// The read side is well covered; the submission side is where a chip quietly
// goes missing, because the failure is the omission of a LINE. Nothing throws,
// no test turns red, and the loss only shows up as a column that is null for
// every row on one platform — which is how the RN SDK read the PACE diagnostic
// on every session and never sent it, while Flutter always did.
//
// So: one builder, and every path that submits a chip goes through it.
import { buildVerifyRequest, nfcPayload } from '../store/submit';
import { buildApplicantVerifyRequest } from '../store/submitApplicant';
import { createKycStore } from '../store/kycStore';
import type { ResolvedKYCConfig } from '../types/config';
import type { EmrtdReadResult } from '../emrtd/session';

jest.useFakeTimers();

/** A chip that gave up everything it holds, read over BAC after PACE declined. */
const FULL_CHIP: EmrtdReadResult = {
  dg1: 'ZGcx',
  sod: 'c29k',
  dg2: 'ZGcy',
  dg7: 'ZGc3',
  dg11: 'ZGcxMQ==',
  dg12: 'ZGcxMg==',
  chipAuth: 'bac',
  paceOutcome: 'notOffered',
  paceDetail: 'chip published no EF.CardAccess',
};

function makeStore() {
  return createKycStore({
    apiKey: 'pk_test_x',
    country: 'NG',
    metadata: {},
  } as unknown as ResolvedKYCConfig);
}

describe('nfcPayload', () => {
  it('carries every group the chip gave up', () => {
    const wire = nfcPayload(FULL_CHIP);
    expect(wire).toMatchObject({
      dg1: 'ZGcx',
      sod: 'c29k',
      dg2: 'ZGcy',
      dg7: 'ZGc3',
      dg11: 'ZGcxMQ==',
      dg12: 'ZGcxMg==',
      chipAuth: 'bac',
    });
  });

  it('carries the PACE diagnostic, which is the whole point of recording it', () => {
    // `chipAuth: 'bac'` alone cannot tell "this chip does not speak PACE" from
    // "our PACE implementation broke". Those call for opposite responses.
    const wire = nfcPayload(FULL_CHIP);
    expect(wire.paceOutcome).toBe('notOffered');
    expect(wire.paceDetail).toBe('chip published no EF.CardAccess');
  });

  it('omits absent groups rather than sending them empty', () => {
    const wire = nfcPayload({ dg1: 'ZGcx', chipAuth: 'pace' } as EmrtdReadResult);
    expect(wire).toEqual({ dg1: 'ZGcx', chipAuth: 'pace' });
    expect('dg2' in wire).toBe(false);
    expect('paceOutcome' in wire).toBe(false);
  });
});

describe('every submitting path sends the same chip block', () => {
  it('single-ID run', () => {
    const store = makeStore();
    store.setState({ selectedIdType: 'passport', chipData: FULL_CHIP });
    expect(buildVerifyRequest(store.getState(), undefined).nfc).toEqual(nfcPayload(FULL_CHIP));
  });

  it('multi-ID: the chip rides its OWN check, not the submission', () => {
    const store = makeStore();
    store.setState({
      multiIdSlots: [
        { idType: 'bvn', idNumber: '12345678901' },
        { idType: 'passport', documentFront: 'med_1', chipData: FULL_CHIP },
      ],
    });
    const req = buildVerifyRequest(store.getState(), undefined);
    // Top level carries no chip: the BVN is the primary check and never had one.
    expect(req.nfc).toBeUndefined();
    expect(req.idChecks?.[0]).not.toHaveProperty('nfc');
    expect(req.idChecks?.[1]?.nfc).toEqual(nfcPayload(FULL_CHIP));
  });

  it("applicant leg — the KYB submitter's own KYC", () => {
    const store = makeStore();
    store.setState({ selectedIdType: 'passport', chipData: FULL_CHIP });
    const req = buildApplicantVerifyRequest(store.getState(), 'kp_1', undefined);
    expect(req.nfc).toEqual(nfcPayload(FULL_CHIP));
  });
});
