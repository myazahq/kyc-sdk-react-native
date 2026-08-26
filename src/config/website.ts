// Is this a website address?
//
// Deliberately not a URL parser. `new URL(value)` rejects "company.com" for
// having no scheme, which is how almost everyone writes a website, and accepts
// "mailto:x@y" and "javascript:alert(1)" for having one. Both answers are the
// wrong way round for a field labelled "Website". Mirrors the web SDK's
// lib/website.ts — keep the two in lockstep.

/** Trim, drop a scheme, drop a trailing slash. What the checks below run on. */
function hostOf(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export function isValidWebsite(value: string): boolean {
  const raw = value.trim();
  if (raw === '') return true; // Empty is for the required-field check, not this.

  // A scheme we do not serve is a mistake worth catching: "mailto:" in a
  // website box is a different thing entirely, not a typo in this one.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return false;

  const host = hostOf(raw);
  if (host.length === 0 || host.length > 253) return false;
  if (!HOST.test(host)) return false;

  // A TLD of at least two letters. Rules out "company." and "192.168.0.1",
  // neither of which is a website somebody meant to type.
  const tld = host.slice(host.lastIndexOf('.') + 1);
  return /^[a-z]{2,}$/i.test(tld);
}
