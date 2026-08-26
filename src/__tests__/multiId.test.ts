import {
  multiIdConfigFrom,
  multiIdSafeOptions,
  multiIdSlotOptions,
  multiIdWireSlots,
} from '../lib/multi-id';

// These rules MIRROR the server's lib/multi-id.ts. The server validates the
// pick sequence the client produced, so a client that computes options
// differently produces submissions the server rejects.

describe('multiIdConfigFrom', () => {
  it('reads the policy and clamps it', () => {
    expect(multiIdConfigFrom({ multiId: { count: 2, minPassed: 2 } })).toEqual({
      count: 2,
      minPassed: 2,
    });
    expect(multiIdConfigFrom({ multiId: { count: 3, minPassed: 1 } })).toEqual({
      count: 3,
      minPassed: 1,
    });
  });

  it('REJECTS an out-of-range count rather than clamping it', () => {
    // The server returns null here. Clamping made the client walk 3 checks for
    // a config the server does not consider multi-ID at all, and let minPassed
    // exceed the count — "9 of 3 must pass", which nothing can satisfy.
    expect(multiIdConfigFrom({ multiId: { count: 9, minPassed: 9 } })).toBeNull();
    // A fractional count TRUNCATES rather than rejecting — which is also what
    // the server does, and agreeing with the server is the whole point here.
    expect(multiIdConfigFrom({ multiId: { count: 2.5, minPassed: 2 } })?.count).toBe(2);
  });

  it('clamps minPassed within the count', () => {
    expect(multiIdConfigFrom({ multiId: { count: 2, minPassed: 5 } })?.minPassed).toBe(2);
    expect(multiIdConfigFrom({ multiId: { count: 2, minPassed: 0 } })?.minPassed).toBe(1);
  });

  it('is null for ordinary flows and for every KYB flow', () => {
    expect(multiIdConfigFrom({})).toBeNull();
    expect(multiIdConfigFrom({ multiId: { count: 1, minPassed: 1 } })).toBeNull();
    expect(
      multiIdConfigFrom({ subjectType: 'business', multiId: { count: 2, minPassed: 2 } }),
    ).toBeNull();
  });
});

describe('safe options', () => {
  const offered = ['nin', 'bvn', 'passport'];

  it('never offers an ID already used earlier in the run', () => {
    const options = multiIdSlotOptions(2, undefined, offered);
    expect(multiIdSafeOptions(options, 1, ['nin'])).toEqual(['bvn', 'passport']);
  });

  it('never offers a pick that would STRAND a later check', () => {
    // Check 2 may only offer BVN. Picking BVN first would leave it nothing.
    const options = multiIdSlotOptions(2, [{}, { idTypes: ['bvn'] }], offered);
    expect(multiIdSafeOptions(options, 0, [])).toEqual(['nin', 'passport']);
  });

  it('offers nothing when every remaining pick would strand', () => {
    const options = multiIdSlotOptions(2, [{ idTypes: ['bvn'] }, { idTypes: ['bvn'] }], offered);
    expect(multiIdSafeOptions(options, 0, [])).toEqual([]);
  });
});

describe('multiIdWireSlots', () => {
  it('strips the local previews the slots carry for the back journey', () => {
    // A device file URI must never reach the submission or the progress blob.
    expect(
      multiIdWireSlots([
        {
          idType: 'nin',
          idNumber: '123',
          documentFront: 'med_1',
          documentFrontImage: 'file:///tmp/front.jpg',
        } as never,
      ]),
    ).toEqual([{ idType: 'nin', idNumber: '123', documentFront: 'med_1' }]);
  });
});
