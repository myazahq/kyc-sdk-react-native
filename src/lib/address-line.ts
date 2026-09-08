// The address line the flow SHOWS. Split from address-flow.ts (200-line
// rule); a mirror of the web SDK's displayAddressLine and the Flutter
// address_flow.dart twin. Keep the three in lockstep.

/**
 * The address line the flow SHOWS (pin summary + review heading) — the client
 * mirror of the server's composed-line rules, so what the applicant confirms is
 * what the org later reads. A typed number REPLACES a differing picked number
 * (living at 8 when only 11 was listed is not "8, 11 Bassey Street"); a typed
 * street the label does not carry leads the line.
 */
export function displayAddressLine(address: {
  lat: number;
  lng: number;
  label?: string | null;
  propertyNumber?: string | null;
  street?: string | null;
  unit?: string | null;
  neighbourhood?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
}): string {
  const number = address.propertyNumber?.trim() || null;
  const typed = address.street?.trim() || null;
  const label = address.label?.trim() || null;
  const unit = address.unit?.trim() || null;
  // Edit-details corrections ride the tail through a part-wise dedupe,
  // mirroring the server's composed line: identical values vanish, a
  // correction appends beside the map's own answer.
  const withClaims = (parts: string[]): string => {
    const out = unit ? [unit, ...parts] : [...parts];
    const seen = (v: string) => out.some((p) => p.toLowerCase() === v.toLowerCase());
    for (const claim of [address.neighbourhood, address.city, address.state, address.postcode]) {
      const t = claim?.trim();
      if (t && !seen(t)) out.push(t);
    }
    return out.join(', ');
  };
  if (!label) {
    if (typed) return withClaims([number ? `${number} ${typed}` : typed]);
    const claimed = withClaims([]);
    if (claimed) return claimed;
    // NEVER coordinates. A moved pin has no line until the reverse geocode
    // answers, and "4.93240, 8.32540" is not an address: it read as one, for
    // the second or so before the real line arrived. Empty means "nothing
    // human-readable yet", and the caller shows that it is still coming.
    return '';
  }
  const segs = label
    .split(', ')
    .map((t) => t.trim())
    .filter(Boolean);
  if (typed && !label.toLowerCase().includes(typed.toLowerCase())) {
    return withClaims([number ? `${number} ${typed}` : typed, ...segs]);
  }
  if (number) {
    const first = segs[0] ?? '';
    const firstTokens = first.toLowerCase().split(/\s+/);
    const leading = firstTokens[0] ?? '';
    if (/^\d+[a-z]?$/i.test(leading) && leading !== number.toLowerCase()) {
      segs[0] = [number, ...first.split(/\s+/).slice(1)].join(' ');
    } else if (!firstTokens.includes(number.toLowerCase())) {
      return withClaims([number, ...segs]);
    }
  }
  return withClaims(segs);
}

/** Read to assistive tech while the reverse geocode is out: the pin has a
 *  line coming, and a lat/lng pair is not it. Sighted users see a skeleton
 *  line in its place (components/LineSkeleton), never a spinner. Mirrored on
 *  the web and Flutter SDKs. */
export const ADDRESS_LINE_PENDING = 'Finding the address…';
/** Shown when the geocode came back with nothing. Still not coordinates. */
export const ADDRESS_LINE_UNAVAILABLE = 'No address found for this spot';
