import { isoDateOnly, registerPrefillPatch } from '../config/businessPrefill';
import { businessDetailsValid } from '../config/businessDetailsValidity';
import { isValidWebsite } from '../config/website';
import { companyInfoFieldModes } from '../config/business';
import { EMPTY_BUSINESS } from '../store/state';
import type { BusinessCompanyRecord } from '../services/api';
import type { BusinessState } from '../store/state';

// ─── Confirming what the register said ───────────────────────────────────────
//
// The details screen opens holding the register's answers, but they are a
// starting point rather than the last word: only EMPTY fields are filled, and
// which ones the register wrote is recorded so a company change clears exactly
// those. Mirrors the web SDK's prefillFromRegister semantics.

const record = (over: Partial<BusinessCompanyRecord> = {}): BusinessCompanyRecord => ({
  name: 'FLITSTACK LTD',
  registrationNumber: 'RC1981610',
  registrationDate: '2018-03-12T00:00:00.000Z',
  typeOfEntity: 'Private Limited Company',
  companyStatus: 'ACTIVE',
  address: '12 Marina Road',
  email: 'hello@flitstack.com',
  phone: '+2348030000000',
  taxId: '01234567-0001',
  vatNumber: null,
  natureOfBusiness: 'Software',
  city: 'Lagos Island',
  state: 'Lagos',
  ...over,
});

const businessState = (over: Partial<BusinessState> = {}): BusinessState => ({
  ...EMPTY_BUSINESS,
  ...over,
});

describe('registerPrefillPatch', () => {
  it('fills only empty fields and records which ones', () => {
    // The applicant typed their own email before the lookup — they meant it.
    const { patch, prefilled } = registerPrefillPatch(
      record(),
      businessState({ email: 'ceo@flitstack.com' }),
    );
    expect(patch.email).toBeUndefined();
    expect(patch.registrationName).toBe('FLITSTACK LTD');
    expect(patch.companyType).toBe('Private Limited Company');
    expect(prefilled).not.toContain('email');
    expect(prefilled).toContain('registrationName');
  });

  it('joins the address across the register’s lines', () => {
    // One box on the form; dropping city/state would drop real address parts.
    const { patch } = registerPrefillPatch(record(), businessState());
    expect(patch.address).toBe('12 Marina Road, Lagos Island, Lagos');
  });

  it('reads the incorporation date only when it is unambiguous ISO', () => {
    const { patch } = registerPrefillPatch(record(), businessState());
    expect(patch.dateOfIncorporation).toBe('2018-03-12');
  });

  it('returns nothing for a company the register never answered for', () => {
    const { patch, prefilled } = registerPrefillPatch(null, businessState());
    expect(patch).toEqual({});
    expect(prefilled).toEqual([]);
  });
});

describe('isoDateOnly', () => {
  it('accepts only an unambiguous ISO date', () => {
    expect(isoDateOnly('2018-03-12')).toBe('2018-03-12');
    expect(isoDateOnly('2018-03-12T10:00:00Z')).toBe('2018-03-12');
    // "12/03/2018" is 12 March to a DD/MM register and 3 December to
    // `new Date` — a confidently wrong date in a compliance form, so refused.
    expect(isoDateOnly('12/03/2018')).toBeNull();
    expect(isoDateOnly('March 2018')).toBeNull();
    // The calendar is checked: 2018-02-31 must not roll into March.
    expect(isoDateOnly('2018-02-31')).toBeNull();
    expect(isoDateOnly(null)).toBeNull();
  });
});

describe('businessDetailsValid', () => {
  const modes = companyInfoFieldModes({ country: 'NG' });
  const base = {
    modes,
    product: 'business',
    numberValid: true,
    nameRequired: false,
    showContactEmail: false,
  };

  it('gates only the pick fields on the pick screen', () => {
    // The detail fields do not exist yet on the pick screen — holding Continue
    // for them would wait on inputs that are not on screen.
    const business = businessState({ registrationNumber: 'RC1', website: 'not a website' });
    expect(businessDetailsValid({ ...base, phase: 'pick', business })).toBe(true);
    expect(businessDetailsValid({ ...base, phase: 'details', business })).toBe(false);
  });

  it('blocks details on a missing required company-info field', () => {
    const strictModes = companyInfoFieldModes({
      country: 'NG',
      companyInfo: { address: 'required' },
    });
    const business = businessState({ registrationNumber: 'RC1' });
    expect(
      businessDetailsValid({ ...base, modes: strictModes, phase: 'details', business }),
    ).toBe(false);
    expect(
      businessDetailsValid({
        ...base,
        modes: strictModes,
        phase: 'details',
        business: businessState({ registrationNumber: 'RC1', address: '12 Marina Road' }),
      }),
    ).toBe(true);
  });

  it('blocks a malformed contact email but never an empty one', () => {
    const withEmail = { ...base, showContactEmail: true, phase: 'details' as const };
    expect(
      businessDetailsValid({
        ...withEmail,
        business: businessState({ registrationNumber: 'RC1' }),
      }),
    ).toBe(true);
    expect(
      businessDetailsValid({
        ...withEmail,
        business: businessState({ registrationNumber: 'RC1', contactEmail: 'not-an-email' }),
      }),
    ).toBe(false);
  });
});

describe('isValidWebsite', () => {
  it('accepts websites the way people write them', () => {
    expect(isValidWebsite('company.com')).toBe(true);
    expect(isValidWebsite('https://company.com/about')).toBe(true);
    expect(isValidWebsite('')).toBe(true); // emptiness is the required-check's job
  });

  it('refuses what is not a website', () => {
    expect(isValidWebsite('mailto:x@y.com')).toBe(false);
    expect(isValidWebsite('company.')).toBe(false);
    expect(isValidWebsite('192.168.0.1')).toBe(false);
  });
});
