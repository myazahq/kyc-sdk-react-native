import {
  DEFAULT_POA_MAX_AGE_DAYS,
  hasProofOfAddressStep,
  isAcceptedPoaMimeType,
  poaDocumentTypes,
  poaMaxAgeDays,
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
      'other',
    ]);
  });

  it('treats an empty list as "all", not "none"', () => {
    // A workflow that enabled the step but left the list empty still wants the
    // step to work — offering nothing would be an un-completable screen.
    expect(poaDocumentTypes({ enabled: true, documentTypes: [] })).toHaveLength(4);
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
