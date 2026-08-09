// ---------------------------------------------------------------------------
// Amount formatting
//
// Groups thousands as the user types (250000 → 250,000) and caps the decimals,
// matching the Flutter SDK's AmountInputFormatter and the web SDK's money
// input. Long figures are the norm for the expected-volume question in
// low-denomination currencies, and an ungrouped "250000" is genuinely hard to
// read back.
//
// The DISPLAY is grouped; the ANSWER stays a number. Storing the grouped string
// would fail validation — `Number("250,000")` is NaN — and would reach the
// server as text where the decision graph expects something comparable.
// ---------------------------------------------------------------------------

/** Keeps digits plus at most one '.', truncating past `decimalDigits`. */
function clean(input: string, decimalDigits: number): string {
  let out = '';
  let seenDot = false;
  let decimals = 0;

  for (const ch of input) {
    if (ch === '.') {
      // Integer-only: everything past the point is fractional, so DROP the
      // rest. Merely skipping the '.' would splice "1234.99" into "123499".
      if (decimalDigits === 0) break;
      if (seenDot) continue;
      seenDot = true;
      out += ch;
      continue;
    }
    if (ch < '0' || ch > '9') continue;
    if (seenDot) {
      if (decimals >= decimalDigits) continue;
      decimals += 1;
    }
    out += ch;
  }
  return out;
}

function group(digits: string): string {
  if (digits.length <= 3) return digits;
  const lead = digits.length % 3;
  const parts: string[] = [];
  let i = 0;
  if (lead > 0) {
    parts.push(digits.slice(0, lead));
    i = lead;
  }
  while (i < digits.length) {
    parts.push(digits.slice(i, i + 3));
    i += 3;
  }
  return parts.join(',');
}

/** "250000.5" → "250,000.5". Non-numeric characters are dropped. */
export function formatGroupedAmount(input: string, decimalDigits = 2): string {
  const cleaned = clean(input, decimalDigits);
  if (cleaned === '') return '';
  const dot = cleaned.indexOf('.');
  const whole = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const fraction = dot === -1 ? '' : cleaned.slice(dot);
  return group(whole) + fraction;
}

/** Numeric value of a grouped amount string ("250,000.50" → 250000.5). */
export function parseGroupedAmount(text: string): number | null {
  const raw = text.replace(/,/g, '').trim();
  if (raw === '' || raw === '.') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
