import { businessCountryName, type BusinessProductDef } from './business';

// ---------------------------------------------------------------------------
// Country-aware guidance for the registration-number input.
//
// Nigeria's registry (CAC) prefixes every number by entity type — the provider
// rejects a number whose prefix is missing or separated from the digits — so
// NG gets explicit prefix guidance AND format validation. Other registries get
// a placeholder + tip only; no format is enforced outside Nigeria.
//
// Ported from the web SDK's `lib/registration-hint.ts` — keep the two in step
// (country examples/tips are registry-verified there).
// ---------------------------------------------------------------------------

export interface RegistrationHint {
  placeholder: string;
  /** Guidance rendered beneath the input (null = nothing to show). */
  tip: string | null;
  /** Format check for the typed value (null = only non-empty is required). */
  isValidFormat: ((value: string) => boolean) | null;
  /** Inline error when isValidFormat fails. */
  formatError: string | null;
}

const NG_PREFIX_RE = /^(RC|BN|IT|LP|LLP)\d+$/i;

const NG_TIP =
  'Prefix your registration number with RC for private companies limited by shares, ' +
  'BN for business names, IT for incorporated trustees, LP for limited partnerships or ' +
  'LLP for limited liability partnerships — with no space or character between the ' +
  'prefix and the number, e.g. RC0000000.';

// Countries whose English name takes a definite article ("the United States").
const THE_COUNTRIES = new Set([
  'US', 'GB', 'AE', 'NL', 'PH', 'CZ', 'GM', 'BS', 'MV', 'CD', 'CF', 'DO', 'KM', 'MH', 'SB', 'CG',
]);

function countryName(code: string): string {
  const name = businessCountryName(code);
  return THE_COUNTRIES.has(code.toUpperCase()) ? `the ${name}` : name;
}

const COUNTRY_EXAMPLES: Record<string, string> = {
  KE: 'PVT-JZUA6Z663',
  ZA: '201133333323',
};

const COUNTRY_TIPS: Record<string, string> = {
  KE: 'Your registration number as it appears on your certificate of incorporation, e.g. PVT-JZUA6Z663.',
  ZA: 'Your CIPC registration number — printed as 2011/333333/23 on your documents; enter it without the slashes, e.g. 201133333323.',
};

export function registrationNumberHint(
  country: string,
  productDef: BusinessProductDef,
): RegistrationHint {
  // TIN-keyed products keep their own placeholder/format (not a registry number).
  if (productDef.inputLabel === 'TIN') {
    return {
      placeholder: productDef.placeholder,
      tip: 'Your tax identification number as issued by the tax authority, e.g. 01234567-0001.',
      isValidFormat: null,
      formatError: null,
    };
  }

  if (country === 'NG') {
    return {
      placeholder: 'e.g. RC0000000',
      tip: NG_TIP,
      isValidFormat: (value) => NG_PREFIX_RE.test(value.trim()),
      formatError:
        'Start with RC, BN, IT, LP or LLP followed by the number, no spaces, e.g. RC0000000.',
    };
  }

  const cc = country.toUpperCase();
  const example = COUNTRY_EXAMPLES[cc];
  return {
    placeholder: example ? `e.g. ${example}` : 'Enter your registration number',
    tip:
      COUNTRY_TIPS[cc] ??
      `Your official company registration number, exactly as issued by the business registry in ${countryName(country)}.`,
    isValidFormat: null,
    formatError: null,
  };
}
