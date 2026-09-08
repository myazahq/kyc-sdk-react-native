import {
  DEFAULT_POA_MAX_AGE_DAYS,
  hasProofOfAddressStep,
  isAcceptedPoaMimeType,
  poaCountryAccepted,
  poaDocumentTypes,
  poaMaxAgeDays,
  poaNamePolicy,
  poaTypeLabel,
} from '../config/proofOfAddress';

// ─── Proof of Address ─────────────────────────────────────────────────────────
//
// A recent bill or statement, read server-side and checked against the
// subject's name and a recency window. The verdict is SOFT — it never fails the
// verification — so the client's job is only to attach the right kind of file
// and say plainly what is expected of it.

describe('step presence', () => {
  it('needs an explicit enable', () => {
    expect(hasProofOfAddressStep({ enabled: true })).toBe(true);
    expect(hasProofOfAddressStep({})).toBe(false);
    expect(hasProofOfAddressStep(undefined)).toBe(false);
  });
});

describe('offered document kinds', () => {
  it('offers all of them when the workflow does not narrow it', () => {
    expect(poaDocumentTypes(undefined)).toEqual([
      'utility_bill',
      'bank_statement',
      'tenancy_agreement',
      'government_document',
      'other',
    ]);
  });

  it('treats an empty list as "all", not "none"', () => {
    // A workflow that enabled the step but left the list empty still wants the
    // step to work — offering nothing would be an un-completable screen.
    expect(poaDocumentTypes({ enabled: true, documentTypes: [] })).toHaveLength(5);
  });

  it('honours a narrowed list', () => {
    expect(poaDocumentTypes({ enabled: true, documentTypes: ['bank_statement'] })).toEqual([
      'bank_statement',
    ]);
  });
});

describe('labels', () => {
  it('names each kind', () => {
    expect(poaTypeLabel('utility_bill', undefined)).toBe('Utility bill');
  });

  it('lets an org say what "other" means for them', () => {
    // "Other document" tells the user nothing; "Council tax letter" tells them
    // exactly what to go and find.
    expect(poaTypeLabel('other', { otherLabel: 'Council tax letter' })).toBe('Council tax letter');
  });

  it('ignores a blank custom label', () => {
    expect(poaTypeLabel('other', { otherLabel: '   ' })).toBe('Other document');
  });

  it('does not apply the custom label to other kinds', () => {
    expect(poaTypeLabel('utility_bill', { otherLabel: 'Council tax letter' })).toBe('Utility bill');
  });
});

describe('recency window', () => {
  it('defaults to 90 days', () => {
    expect(poaMaxAgeDays(undefined)).toBe(DEFAULT_POA_MAX_AGE_DAYS);
  });

  it('uses the configured window — the number shown must be the one enforced', () => {
    expect(poaMaxAgeDays({ maxAgeDays: 30 })).toBe(30);
  });
});

describe('accepted files', () => {
  it('accepts photos and PDFs', () => {
    // A proof of address is usually a downloaded statement, which is why this
    // is the one media kind that takes a PDF at all.
    expect(isAcceptedPoaMimeType('image/jpeg')).toBe(true);
    expect(isAcceptedPoaMimeType('image/png')).toBe(true);
    expect(isAcceptedPoaMimeType('image/webp')).toBe(true);
    expect(isAcceptedPoaMimeType('application/pdf')).toBe(true);
  });

  it('ignores codec parameters and case', () => {
    expect(isAcceptedPoaMimeType('IMAGE/JPEG')).toBe(true);
    expect(isAcceptedPoaMimeType('application/pdf; charset=binary')).toBe(true);
  });

  it('rejects what the server cannot read', () => {
    expect(isAcceptedPoaMimeType('video/mp4')).toBe(false);
    expect(isAcceptedPoaMimeType('application/msword')).toBe(false);
    expect(isAcceptedPoaMimeType(undefined)).toBe(false);
  });
});

describe('per-country document kinds', () => {
  const poa = {
    enabled: true,
    documentTypes: ['utility_bill' as const],
    countryDocuments: { GB: ['bank_statement' as const, 'other' as const] },
    countries: ['NG', 'gb'],
  };

  it("a country's override replaces the global list for that country only", () => {
    expect(poaDocumentTypes(poa, 'gb')).toEqual(['bank_statement', 'other']);
    expect(poaDocumentTypes(poa, 'NG')).toEqual(['utility_bill']);
    expect(poaDocumentTypes(poa, null)).toEqual(['utility_bill']);
  });

  it('an empty override falls through to the global list', () => {
    expect(poaDocumentTypes({ enabled: true, countryDocuments: { NG: [] } }, 'NG')).toHaveLength(5);
  });

  it('the accepted-country list is case-insensitive and empty means everyone', () => {
    expect(poaCountryAccepted(poa, 'GB')).toBe(true);
    expect(poaCountryAccepted(poa, 'ng')).toBe(true);
    expect(poaCountryAccepted(poa, 'KE')).toBe(false);
    expect(poaCountryAccepted({ enabled: true }, 'KE')).toBe(true);
    expect(poaCountryAccepted(poa, null)).toBe(true);
  });
});

describe('kinds this build does not know', () => {
  it('are hidden from the picker rather than drawn as a blank row', () => {
    expect(poaDocumentTypes({ enabled: true, documentTypes: ['utility_bill', 'holographic_deed'] as never })).toEqual([
      'utility_bill',
    ]);
    // An override made only of unknown kinds falls through, never to nothing.
    expect(
      poaDocumentTypes({ enabled: true, countryDocuments: { NG: ['holographic_deed'] as never } }, 'NG'),
    ).toHaveLength(5);
  });
});

describe('the name rule', () => {
  it('is required when the workflow says nothing', () => {
    expect(poaNamePolicy(undefined, 'NG', 'utility_bill')).toBe('required');
  });

  it("a country's per-kind exception beats the default for that kind alone", () => {
    const poa = { enabled: true, nameMatch: 'optional' as const, countryNameMatch: { NG: { utility_bill: 'off' as const } } };
    expect(poaNamePolicy(poa, 'ng', 'utility_bill')).toBe('off');
    expect(poaNamePolicy(poa, 'NG', 'bank_statement')).toBe('optional');
    expect(poaNamePolicy(poa, 'GH', 'utility_bill')).toBe('optional');
  });
});
