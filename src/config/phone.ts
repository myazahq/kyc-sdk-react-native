import { AsYouType, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/min';

// ---------------------------------------------------------------------------
// National-format a phone number as it is typed.
//
// libphonenumber's national formats are keyed to the country's TRUNK PREFIX —
// the leading 0 in "0803 123 4567". Feed it a Nigerian number the way a picker
// UI collects it (dial code chosen separately, so "8031234567"), and no format
// matches: it hands back the raw digits and the field looks broken.
//
// So: try the country formatter first, because it is the only thing that knows
// per-country rules — including the countries where the leading 0 is genuinely
// part of the number (Italy: "06 1234 5678"). If it grouped nothing, re-run it
// on the international form and drop the "+CC " prefix, which yields the same
// grouping Flutter's formatNsn() produces.
// ---------------------------------------------------------------------------

/** True once the formatter has actually grouped something. */
const isGrouped = (value: string): boolean => /[\s\-()./]/.test(value);

export function formatNationalNumber(typed: string, country: CountryCode): string {
  const digits = typed.replace(/\D+/g, '');
  if (!digits) return '';

  // AsYouType is stateful per instance — never reuse one across keystrokes.
  const direct = new AsYouType(country).input(digits);
  if (isGrouped(direct)) return direct;

  try {
    const prefix = `+${getCountryCallingCode(country)}`;
    const international = new AsYouType().input(`${prefix}${digits}`);
    return international.startsWith(prefix)
      ? international.slice(prefix.length).trim()
      : direct;
  } catch {
    // Unknown country code — leave the digits alone rather than mangling them.
    return direct;
  }
}
