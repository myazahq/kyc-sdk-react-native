import type { BusinessCompanyRecord } from '../services/api';
import type { BusinessState } from '../store/state';

// ---------------------------------------------------------------------------
// Copy what the register returned into the form, without overwriting anything.
//
// Only empty fields are filled: an applicant who typed something before the
// lookup meant it, and the register is a starting point here rather than the
// last word. Every value stays editable either way. Returns the patch AND the
// keys it filled, so a company change can clear exactly those and leave the
// applicant's own answers alone. Mirrors the web SDK's prefillFromRegister.
// ---------------------------------------------------------------------------

export function registerPrefillPatch(
  company: BusinessCompanyRecord | null,
  current: BusinessState,
): { patch: Partial<BusinessState>; prefilled: (keyof BusinessState)[] } {
  const patch: Partial<BusinessState> = {};
  if (!company) return { patch, prefilled: [] };

  // Field by field, from the register's answer to the form's question. The
  // register does not answer all of these for every company, so each is
  // filled only when it actually came back.
  const fill = (
    key:
      | 'registrationName' | 'address' | 'companyType' | 'email' | 'phone'
      | 'taxId' | 'vatNumber' | 'dateOfIncorporation' | 'natureOfBusiness',
    value: string | null | undefined,
  ): void => {
    if (value && !current[key].trim()) patch[key] = value;
  };
  fill('registrationName', company.name);
  // The register splits the address across lines; the form has one box, so
  // they are joined rather than dropping the parts that did not fit.
  fill(
    'address',
    [company.address, company.city, company.state].filter(Boolean).join(', ') || null,
  );
  fill('companyType', company.typeOfEntity);
  fill('email', company.email);
  fill('phone', company.phone);
  fill('taxId', company.taxId);
  fill('vatNumber', company.vatNumber);
  fill('natureOfBusiness', company.natureOfBusiness);
  // The register gives an incorporation DATE; the field wants YYYY-MM-DD, and
  // anything it cannot be read as is left blank rather than guessed at.
  fill('dateOfIncorporation', isoDateOnly(company.registrationDate));

  return { patch, prefilled: Object.keys(patch) as (keyof BusinessState)[] };
}

/**
 * The date part of an ISO timestamp, or null.
 *
 * Deliberately NOT `new Date(value)`. That parser is lenient in exactly the
 * wrong direction: it reads "12/03/2018" as 2 December (US order, when a
 * register returning DD/MM means 12 March), "sometime in 2018" as 2017-12-31,
 * and "March 2018" as the 28th. Each of those is a confidently wrong date
 * written into a compliance form, which is worse than an empty field somebody
 * fills in themselves. So only an unambiguous ISO date is accepted, and the
 * calendar is checked afterwards so 2018-02-31 does not roll into March.
 */
export function isoDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s]|$)/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const parsed = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // A real date, not one that rolled over into the next month.
  return parsed.toISOString().slice(0, 10) === `${y}-${m}-${d}` ? `${y}-${m}-${d}` : null;
}
