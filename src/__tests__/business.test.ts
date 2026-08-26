import {
  businessCountriesFor,
  businessProductsFor,
  businessProductsForCountry,
  companyInfoFieldModes,
  getBusinessProductDef,
  isBusinessFlow,
  keyPeopleNeedsContactEmail,
  missingRequiredCompanyInfo,
} from '../config/business';
import {
  businessSectionSteps,
  hasApplicantVerification,
  hasBusinessDocumentsStep,
  hasKeyPeopleCollection,
  keyPeopleMinEntries,
  resolveBusinessDocumentTypes,
} from '../config/businessSteps';
import type { WorkflowBusinessConfig } from '../types/business';

// ─── Business (KYB) ───────────────────────────────────────────────────────────
//
// A registry lookup proves a business EXISTS; it proves nothing about who is
// filling in the form, since registration numbers are public. The rest of the
// application (key people, documents, the applicant's own KYC) is what closes
// that gap — so which of those steps run, and what the submission carries, is
// the part worth pinning.

const business = (over: Partial<WorkflowBusinessConfig> = {}): WorkflowBusinessConfig => ({
  country: 'NG',
  ...over,
});

describe('whether the flow is KYB', () => {
  it('needs BOTH the subject type and the business block', () => {
    // `subjectType` alone would submit with no registry country, which the
    // server refuses — so it is not enough on its own.
    expect(isBusinessFlow({ subjectType: 'business', business: business() })).toBe(true);
    expect(isBusinessFlow({ subjectType: 'business' })).toBe(false);
    expect(isBusinessFlow({ business: business() })).toBe(false);
    expect(isBusinessFlow({})).toBe(false);
  });
});

describe('products', () => {
  it('defaults to the plain business lookup', () => {
    expect(businessProductsFor(undefined)).toEqual(['business']);
    expect(businessProductsFor(business({ products: [] }))).toEqual(['business']);
  });

  it('narrows to what the picked country actually offers', () => {
    // TIN is Nigeria-only; offering it after the visitor picks Ghana produces
    // a submission the server rejects with product_unsupported.
    const cfg = business({ products: ['business', 'business-tin'] });
    expect(businessProductsForCountry(cfg, 'NG')).toEqual(['business', 'business-tin']);
    expect(businessProductsForCountry(cfg, 'GH')).toEqual(['business']);
  });

  it('never leaves a country with nothing to pick', () => {
    // A workflow offering only NG-specific products, viewed from Ghana, must
    // still be completable — the global product is the backstop.
    const cfg = business({ products: ['business-tin'] });
    expect(businessProductsForCountry(cfg, 'GH')).toEqual(['business']);
  });

  it('describes what to type for each product', () => {
    // A TIN and a Tax ID are different numbers; the label is the only thing
    // telling the user which one is wanted.
    expect(getBusinessProductDef('business-tin').inputLabel).toBe('TIN');
    expect(getBusinessProductDef('business-taxid').inputLabel).toBe('Registration number');
  });

  it('falls back sensibly for a product it has never heard of', () => {
    // The catalogue is display-only; the server can add products at any time
    // and an older SDK must still render an input rather than break.
    const def = getBusinessProductDef('brand-new-product');
    expect(def.key).toBe('brand-new-product');
    expect(def.inputLabel).toBeTruthy();
  });
});

describe('registry countries', () => {
  it('is just the primary when no list is configured', () => {
    expect(businessCountriesFor(business())).toEqual(['NG']);
  });

  it('always includes the primary, first', () => {
    // The primary is the workflow's default; a list that omits it would make
    // the pre-selected country unpickable.
    expect(businessCountriesFor(business({ countries: ['GH', 'KE'] }))).toEqual(['NG', 'GH', 'KE']);
  });

  it('does not duplicate a primary already in the list', () => {
    expect(businessCountriesFor(business({ countries: ['NG', 'GH'] }))).toEqual(['NG', 'GH']);
  });
});

describe('company profile fields', () => {
  it('defaults every field to optional', () => {
    // All nine — the four contact fields plus the five registry facts the
    // applicant states (asked as their own answer; a divergence from the
    // register is the finding).
    expect(companyInfoFieldModes(business())).toEqual({
      address: 'optional',
      email: 'optional',
      phone: 'optional',
      website: 'optional',
      dateOfIncorporation: 'optional',
      taxId: 'optional',
      vatNumber: 'optional',
      companyType: 'optional',
      natureOfBusiness: 'optional',
    });
  });

  it('turns the whole section off', () => {
    const modes = companyInfoFieldModes(business({ collectCompanyInfo: false }));
    expect(Object.values(modes).every((m) => m === 'off')).toBe(true);
  });

  it('lets the master switch override a per-field mode', () => {
    // Otherwise a workflow that switched the section off would still render a
    // required field the user cannot skip.
    const modes = companyInfoFieldModes(
      business({ collectCompanyInfo: false, companyInfo: { address: 'required' } }),
    );
    expect(modes.address).toBe('off');
  });

  it('reports only the REQUIRED fields that are blank', () => {
    const cfg = business({ companyInfo: { address: 'required', email: 'optional' } });
    expect(missingRequiredCompanyInfo(cfg, { address: '', email: '' })).toEqual(['address']);
    expect(missingRequiredCompanyInfo(cfg, { address: '12 Marina' })).toEqual([]);
  });

  it('treats whitespace as blank', () => {
    const cfg = business({ companyInfo: { address: 'required' } });
    expect(missingRequiredCompanyInfo(cfg, { address: '   ' })).toEqual(['address']);
  });
});

describe('the key-people contact email', () => {
  it('is asked for only when invites are emailed AND someone needs full KYC', () => {
    expect(
      keyPeopleNeedsContactEmail(
        business({ keyPeople: { enabled: true, invite: { channel: 'email' }, level: 'full_kyc' } }),
      ),
    ).toBe(true);
  });

  it('is not asked for when nobody needs full KYC', () => {
    // Screening needs no link, so the address would be collected for nothing.
    expect(
      keyPeopleNeedsContactEmail(
        business({
          keyPeople: { enabled: true, invite: { channel: 'email' }, level: 'screening_only' },
        }),
      ),
    ).toBe(false);
  });

  it('is not asked for when the org distributes links itself', () => {
    expect(
      keyPeopleNeedsContactEmail(business({ keyPeople: { enabled: true, level: 'full_kyc' } })),
    ).toBe(false);
  });

  it('respects a per-role override that escalates one role', () => {
    expect(
      keyPeopleNeedsContactEmail(
        business({
          keyPeople: {
            enabled: true,
            invite: { channel: 'email' },
            level: 'screening_only',
            perRole: { beneficial_owner: 'full_kyc' },
          },
        }),
      ),
    ).toBe(true);
  });

  it('ignores a per-role override for a role that is out of scope', () => {
    expect(
      keyPeopleNeedsContactEmail(
        business({
          keyPeople: {
            enabled: true,
            invite: { channel: 'email' },
            roles: ['director'],
            level: 'screening_only',
            perRole: { shareholder: 'full_kyc' },
          },
        }),
      ),
    ).toBe(false);
  });
});

describe('the application section', () => {
  it('is just the details step by default', () => {
    expect(businessSectionSteps(business())).toEqual(['business-details']);
  });

  it('adds each configured step in order', () => {
    expect(
      businessSectionSteps(
        business({
          keyPeople: { enabled: true, collect: true },
          documents: { enabled: true },
          applicant: { verification: true },
        }),
      ),
    ).toEqual([
      'business-details',
      // Documents follow the company they belong to; people come after.
      'business-documents',
      'business-key-people',
      'applicant-role',
    ]);
  });

  it('needs `collect` as well as `enabled` for key-people entry', () => {
    // Enabled-without-collect still discovers people from the registry; it
    // just does not ask the applicant to type them.
    expect(hasKeyPeopleCollection(business({ keyPeople: { enabled: true } }))).toBe(false);
    expect(hasKeyPeopleCollection(business({ keyPeople: { enabled: true, collect: true } }))).toBe(
      true,
    );
  });

  it('reads the other gates from their own flags', () => {
    expect(hasBusinessDocumentsStep(business({ documents: { enabled: true } }))).toBe(true);
    expect(hasApplicantVerification(business({ applicant: { verification: true } }))).toBe(true);
    expect(hasApplicantVerification(business())).toBe(false);
  });
});

describe('requested documents', () => {
  it('asks for nothing when the step is off', () => {
    expect(resolveBusinessDocumentTypes(business())).toEqual([]);
  });

  it('defaults to a required incorporation certificate', () => {
    // The server's own default — a workflow that enabled documents without
    // naming any still has to ask for something.
    expect(resolveBusinessDocumentTypes(business({ documents: { enabled: true } }))).toEqual([
      {
        key: 'incorporation_certificate',
        label: 'Certificate of incorporation',
        required: true,
      },
    ]);
  });

  it('labels each slot, honouring an override', () => {
    const types = resolveBusinessDocumentTypes(
      business({
        documents: {
          enabled: true,
          types: [{ key: 'memart' }, { key: 'other', label: 'Board minutes', required: true }],
        },
      }),
    );
    expect(types.map((t) => t.label)).toEqual(['MEMART / articles of association', 'Board minutes']);
    expect(types.map((t) => t.required)).toEqual([false, true]);
  });
});

describe('minimum disclosed people', () => {
  it('is zero — skippable — unless the workflow says otherwise', () => {
    expect(keyPeopleMinEntries(business({ keyPeople: { enabled: true, collect: true } }))).toBe(0);
  });

  it('is zero when the step does not run at all', () => {
    expect(keyPeopleMinEntries(business({ keyPeople: { enabled: true, minEntries: 3 } }))).toBe(0);
  });

  it('is the configured minimum when disclosure is mandatory', () => {
    expect(
      keyPeopleMinEntries(business({ keyPeople: { enabled: true, collect: true, minEntries: 2 } })),
    ).toBe(2);
  });
});
