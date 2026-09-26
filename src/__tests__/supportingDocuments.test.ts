import {
  hasSupportingDocumentsStep,
  mayAskSupportingDocuments,
  idComposite,
  resolveSupportingDocuments,
  verifiedIdsFor,
} from '../config/supportingDocuments';
import { buildStepOrder } from '../config/stepOrder';

const NIN = idComposite('NG', 'nin');
const BVN = idComposite('NG', 'bvn');

// The organisation names its own documents; nothing in the SDK knows the key.
const ninSlipOnly = {
  enabled: true,
  types: [
    {
      key: 'nin_slip',
      label: 'NIN slip',
      description: 'The slip NIMC issued with your NIN.',
      required: true,
      idTypes: [NIN],
    },
  ],
};

describe('resolveSupportingDocuments', () => {
  it('asks for nothing when the step is off', () => {
    expect(resolveSupportingDocuments(undefined, [NIN])).toEqual([]);
    expect(resolveSupportingDocuments({ types: ninSlipOnly.types }, [NIN])).toEqual([]);
  });

  it('asks a scoped document only of the IDs it names', () => {
    expect(resolveSupportingDocuments(ninSlipOnly, [NIN])).toEqual([
      {
        key: 'nin_slip',
        label: 'NIN slip',
        description: 'The slip NIMC issued with your NIN.',
        required: true,
        reads: [],
      },
    ]);
    // A BVN applicant has no NIN slip, so asking would be a dead end.
    expect(resolveSupportingDocuments(ninSlipOnly, [BVN])).toEqual([]);
  });

  it('offers a scoped document to everyone when the author says always ask', () => {
    // The scope then decides who MUST provide it, not who sees it: an org that
    // needs the slip from NIN verifiers will still take one from anybody who
    // happens to hold it.
    const alwaysAsk = {
      enabled: true,
      types: [{ key: 'nin_slip', label: 'NIN slip', required: true, idTypes: [NIN], alwaysAsk: true }],
    };
    expect(resolveSupportingDocuments(alwaysAsk, [NIN])[0]?.required).toBe(true);
    const [asked] = resolveSupportingDocuments(alwaysAsk, [BVN]);
    expect(asked?.key).toBe('nin_slip');
    // Never blocked for not having a document their ID does not come with.
    expect(asked?.required).toBe(false);
  });

  it('asks an unscoped document of everyone', () => {
    const config = { enabled: true, types: [{ key: 'signed_mandate', label: 'Signed mandate' }] };
    expect(resolveSupportingDocuments(config, [BVN])).toEqual([
      { key: 'signed_mandate', label: 'Signed mandate', description: null, required: false, reads: [] },
    ]);
  });

  it('asks once when a multi-ID run matches twice', () => {
    const config = {
      enabled: true,
      types: [
        { key: 'nin_slip', label: 'NIN slip', idTypes: [NIN] },
        { key: 'nin_slip', label: 'NIN slip', idTypes: [BVN] },
      ],
    };
    expect(resolveSupportingDocuments(config, [NIN, BVN])).toHaveLength(1);
  });
});

describe('verifiedIdsFor', () => {
  it('is the picked ID, or every committed slot', () => {
    expect(verifiedIdsFor({ country: 'NG', idType: 'nin' })).toEqual([NIN]);
    expect(
      verifiedIdsFor({ country: 'NG', idType: 'nin', multiIdSlots: [{ idType: 'nin' }, { idType: 'bvn' }] }),
    ).toEqual([NIN, BVN]);
  });

  it('is empty before a country is known', () => {
    expect(verifiedIdsFor({ country: null, idType: 'nin' })).toEqual([]);
  });
});

describe('the step in the order', () => {
  const base = {
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

  it('is absent unless the caller resolved something to ask for', () => {
    expect(buildStepOrder(base)).not.toContain('supporting-documents');
  });

  it('comes before the address document and the address pin', () => {
    // Paperwork the org files is asked for ahead of the address evidence the
    // verification is judged on (user decision 2026-09-22).
    const order = buildStepOrder({
      ...base,
      hasPoa: true,
      hasSupportingDocuments: true,
      hasAddressCollection: true,
    });
    expect(order.indexOf('supporting-documents')).toBeLessThan(order.indexOf('proof-of-address'));
    expect(order.indexOf('supporting-documents')).toBeLessThan(order.indexOf('address-collection'));
  });
});

describe('hasSupportingDocumentsStep', () => {
  it('is the resolution, not the switch', () => {
    expect(hasSupportingDocumentsStep(ninSlipOnly, [BVN])).toBe(false);
    expect(hasSupportingDocumentsStep(ninSlipOnly, [NIN])).toBe(true);
  });

  // The card tells the applicant what the document is being taken FOR, which
  // is the whole reason it names the fields. Display only: the SERVER decides
  // what is actually read, so this drops blanks and repeats and stops there.
  it('carries the field names the card shows', () => {
    const config = {
      enabled: true,
      types: [
        {
          key: 'bank_letter',
          label: 'Bank letter',
          fields: [
            { key: 'bank_name', label: 'Bank name' },
            { key: 'issued', label: 'Statement date' },
          ],
        },
      ],
    };
    expect(resolveSupportingDocuments(config, ['NG/nin'])[0]?.reads).toEqual([
      'Bank name',
      'Statement date',
    ]);
  });

  it('drops blank and repeated field names', () => {
    const config = {
      enabled: true,
      types: [
        {
          key: 'bank_letter',
          label: 'Bank letter',
          fields: [
            { key: 'a', label: 'Bank name' },
            { key: 'b', label: '  ' },
            { key: 'c' },
            { key: 'd', label: 'bank name' },
          ],
        },
      ],
    };
    expect(resolveSupportingDocuments(config, ['NG/nin'])[0]?.reads).toEqual(['Bank name']);
  });
});

describe('mayAskSupportingDocuments (the consent screen’s question)', () => {
  it('discloses a SCOPED document that the step order cannot yet see', () => {
    // The whole reason the second predicate exists. Consent runs before an ID
    // is picked, so the step order has no verified IDs to resolve against and
    // answers "nothing to ask for" — while the flow will certainly ask a NIN
    // verifier for their slip.
    expect(hasSupportingDocumentsStep(ninSlipOnly, [])).toBe(false);
    expect(mayAskSupportingDocuments(ninSlipOnly)).toBe(true);
  });

  it('promises nothing when the step is off', () => {
    expect(mayAskSupportingDocuments(undefined)).toBe(false);
    expect(mayAskSupportingDocuments(null)).toBe(false);
    expect(mayAskSupportingDocuments({ types: ninSlipOnly.types })).toBe(false);
    expect(mayAskSupportingDocuments({ enabled: false, types: ninSlipOnly.types })).toBe(false);
  });

  it('promises nothing when there is no document to ask for', () => {
    expect(mayAskSupportingDocuments({ enabled: true, types: [] })).toBe(false);
    // A nameless entry renders no slot, so it must not put a bullet on consent.
    expect(
      mayAskSupportingDocuments({
        enabled: true,
        types: [{ key: 'draft', label: '  ', required: false, idTypes: [] }],
      }),
    ).toBe(false);
  });
});
