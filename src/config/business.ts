// ---------------------------------------------------------------------------
// Business (KYB) product catalogue + flow helpers.
//
// Mirrors the server's `business-products.ts` for DISPLAY only — labels and
// input hints. The server stays the source of truth: an unknown or unoffered
// product is rejected at POST /verify with `product_unsupported`, so nothing
// here needs to be authoritative, only honest about what to type.
// ---------------------------------------------------------------------------

import type {
  CompanyInfoField,
  CompanyInfoMode,
  KeyPersonRole,
  SubjectType,
  WorkflowBusinessConfig,
} from '../types/business';
import { regionCountryName } from './regions';

export interface BusinessProductDef {
  key: string;
  label: string;
  /** What the user types — drives the input label/placeholder. */
  inputLabel: string;
  placeholder: string;
  /** Countries offering this product; absent = every supported country. */
  countries?: string[];
}

export const DEFAULT_BUSINESS_PRODUCT = 'business';

export const BUSINESS_PRODUCTS: readonly BusinessProductDef[] = [
  {
    key: 'business',
    label: 'Business verification',
    inputLabel: 'Registration number',
    placeholder: 'e.g. RC0000000',
  },
  {
    key: 'business-tax',
    label: 'Business + Tax ID',
    inputLabel: 'Registration number',
    placeholder: 'e.g. RC0000000',
    countries: ['NG'],
  },
  {
    key: 'business-taxid',
    label: 'Tax ID',
    inputLabel: 'Registration number',
    placeholder: 'e.g. RC0000000',
    countries: ['NG'],
  },
  {
    // A TIN is NOT the Tax ID product — different number, different endpoint.
    key: 'business-tin',
    label: 'TIN',
    inputLabel: 'TIN',
    placeholder: 'e.g. 01234567-0001',
    countries: ['NG'],
  },
];

/** Display definition for a product key (unknown keys get a generic fallback). */
export function getBusinessProductDef(key: string): BusinessProductDef {
  return (
    BUSINESS_PRODUCTS.find((p) => p.key === key) ?? {
      key,
      label: key,
      inputLabel: 'Registration number',
      placeholder: 'Enter your registration number',
    }
  );
}

/** The product keys a business workflow offers (the default when unset). */
export function businessProductsFor(business: WorkflowBusinessConfig | undefined): string[] {
  const products = business?.products;
  return products && products.length > 0 ? products : [DEFAULT_BUSINESS_PRODUCT];
}

/**
 * The products offered for ONE picked country — the configured list narrowed by
 * each product's availability, with the global default as the backstop.
 *
 * The narrowing matters: TIN is Nigeria-only, so offering it after the visitor
 * picks Ghana produces a submission the server refuses.
 */
export function businessProductsForCountry(
  business: WorkflowBusinessConfig | undefined,
  country: string,
): string[] {
  const offered = businessProductsFor(business).filter((key) => {
    const def = BUSINESS_PRODUCTS.find((p) => p.key === key);
    return !def?.countries || def.countries.includes(country);
  });
  return offered.length > 0 ? offered : [DEFAULT_BUSINESS_PRODUCT];
}

/** Registry countries the visitor may pick (primary always included, first). */
export function businessCountriesFor(business: WorkflowBusinessConfig | undefined): string[] {
  if (!business) return [];
  if (business.countries && business.countries.length > 0) {
    return business.countries.includes(business.country)
      ? business.countries
      : [business.country, ...business.countries];
  }
  return [business.country];
}

/** English country name for an ISO-2 code (falls back to the code itself). */
export const businessCountryName = regionCountryName;

/**
 * Whether the resolved config runs the business (KYB) flow.
 *
 * Both halves are required: `subjectType` alone would send a submission with no
 * registry country, which the server rejects. Single source of truth for the
 * gate — the step order, consent routing and submission all read it.
 */
export function isBusinessFlow(config: {
  subjectType?: SubjectType;
  business?: WorkflowBusinessConfig;
}): boolean {
  return config.subjectType === 'business' && !!config.business;
}

/** All key-person roles — the in-scope set when `keyPeople.roles` is unset. */
const KEY_PERSON_ROLES: KeyPersonRole[] = [
  'director',
  'beneficial_owner',
  'signatory',
  'shareholder',
];

/**
 * Whether the business-details step should collect a contact email.
 *
 * Only when invites actually go out by email AND at least one in-scope role
 * needs full KYC — asking for an address the flow will never write to is a
 * field the user fills in for nothing.
 */
export function keyPeopleNeedsContactEmail(business: WorkflowBusinessConfig | undefined): boolean {
  const keyPeople = business?.keyPeople;
  if (!keyPeople?.enabled || keyPeople.invite?.channel !== 'email') return false;
  const roles = keyPeople.roles && keyPeople.roles.length > 0 ? keyPeople.roles : KEY_PERSON_ROLES;
  return roles.some(
    (role) => (keyPeople.perRole?.[role] ?? keyPeople.level ?? 'screening_only') === 'full_kyc',
  );
}

/**
 * Effective per-field company-profile mode.
 *
 * `collectCompanyInfo: false` turns the whole section off; an unlisted field is
 * 'optional'. Mirrors the server's resolution exactly — a mismatch here means
 * either a field the user cannot fill or a 422 they cannot act on.
 */
export function companyInfoFieldModes(
  business: WorkflowBusinessConfig | undefined,
): Record<CompanyInfoField, CompanyInfoMode> {
  const off = business?.collectCompanyInfo === false;
  const modes = business?.companyInfo ?? {};
  return {
    address: off ? 'off' : (modes.address ?? 'optional'),
    email: off ? 'off' : (modes.email ?? 'optional'),
    phone: off ? 'off' : (modes.phone ?? 'optional'),
    website: off ? 'off' : (modes.website ?? 'optional'),
  };
}

/** Company-profile fields still missing that the workflow marks required. */
export function missingRequiredCompanyInfo(
  business: WorkflowBusinessConfig | undefined,
  values: Partial<Record<CompanyInfoField, string>>,
): CompanyInfoField[] {
  const modes = companyInfoFieldModes(business);
  return (Object.keys(modes) as CompanyInfoField[]).filter(
    (field) => modes[field] === 'required' && (values[field] ?? '').trim() === '',
  );
}
