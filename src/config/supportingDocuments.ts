import type { SupportingDocumentsConfig } from '../types/workflow';

// Which supporting documents this flow asks for, given the ID the person
// actually verified with.
//
// MIRROR of the server's `requestedSupportingDocuments`
// (kyc-core src/lib/workflows/supporting-documents-config.ts) and of the web
// SDK's lib/supporting-documents.ts. Three copies of one rule: the mobile SDKs
// cannot import the web package, so a change here changes all three in the
// same commit. The server VALIDATES what the client produced, so a client that
// resolved differently just builds submissions the server refuses.
//
// There is no catalogue to mirror: a document is whatever the ORG named it, so
// the SDK renders the title and guidance the workflow sent rather than
// captioning a key it recognises.

export interface RequestedSupportingDocument {
  key: string;
  label: string;
  /** Guidance under the slot, when the author wrote some. */
  description: string | null;
  required: boolean;
  /**
   * The names of the values the server will read off it, for the card to show.
   *
   * DISPLAY ONLY, and deliberately not a mirror of the server's own field
   * resolution: it drops blanks and repeats and stops there. The server decides
   * what is actually read, and an extra name on a chip costs an applicant
   * nothing.
   */
  reads: string[];
}

/** The names on one document's fields: what the applicant is told we read. */
function documentReads(fields: Array<{ label?: string }> | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const field of fields ?? []) {
    const label = field.label?.trim();
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push(label);
  }
  return out;
}

/** `${country}/${idType}` — the composite a document's `idTypes` is written in. */
export function idComposite(country: string, idType: string): string {
  return `${country.trim().toUpperCase()}/${idType.trim()}`;
}

/**
 * The documents to ask for. An empty result means the step does not appear:
 * a document that exists only because the person used a particular ID must not
 * be put in front of somebody who used another.
 */
export function resolveSupportingDocuments(
  config: SupportingDocumentsConfig | undefined | null,
  verifiedIds: string[],
): RequestedSupportingDocument[] {
  if (!config?.enabled) return [];
  const wanted = new Set(verifiedIds.map((id) => id.toUpperCase()));
  const seen = new Set<string>();
  const out: RequestedSupportingDocument[] = [];
  for (const entry of config.types ?? []) {
    const label = entry.label?.trim();
    // A nameless slot reaches nobody. Publish refuses one, so this only ever
    // bites a draft mid-edit.
    if (!label) continue;
    const scoped = entry.idTypes && entry.idTypes.length > 0;
    const inScope =
      !scoped || entry.idTypes!.some((id) => wanted.has(id.trim().toUpperCase()));
    // `alwaysAsk` keeps the slot on screen for everybody, so the scope decides
    // only who must fill it: an out-of-scope applicant may hand the document
    // over and is never blocked for not having one.
    if (!inScope && entry.alwaysAsk !== true) continue;
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    out.push({
      key: entry.key,
      label,
      description: entry.description?.trim() || null,
      required: entry.required === true && inScope,
      reads: documentReads(entry.fields),
    });
  }
  return out;
}

/** The composites this attempt has committed — one per ID, multi-ID included. */
export function verifiedIdsFor(input: {
  country?: string | null;
  idType?: string | null;
  multiIdSlots?: Array<{ idType: string }>;
}): string[] {
  if (!input.country) return [];
  const slots = input.multiIdSlots ?? [];
  const ids = slots.length > 0 ? slots.map((s) => s.idType) : input.idType ? [input.idType] : [];
  return [...new Set(ids.map((id) => idComposite(input.country!, id)))];
}

/**
 * Whether the flow may ask for a supporting document AT ALL.
 *
 * The CONSENT screen's question, deliberately not the step order's.
 * `hasSupportingDocumentsStep` resolves against the VERIFIED IDS, and consent
 * runs before an ID is picked — so every SCOPED document answers "nothing to
 * ask for" there, and a slip scoped to one ID (the commonest case there is)
 * would go undisclosed.
 *
 * Consent is a DISCLOSURE of what MAY be collected: an applicant seeing a
 * bullet for paperwork they are never asked for is the cheap error, and being
 * asked for undisclosed paperwork is the real one.
 *
 * Still not a raw field check — a disabled step and a nameless entry each
 * promise nothing, the same two gates the resolver applies.
 */
export function mayAskSupportingDocuments(
  config: SupportingDocumentsConfig | undefined | null,
): boolean {
  if (!config?.enabled) return false;
  return (config.types ?? []).some((entry) => (entry.label ?? '').trim().length > 0);
}

/** Whether the step has anything to ask for on this attempt. */
export function hasSupportingDocumentsStep(
  config: SupportingDocumentsConfig | undefined | null,
  verifiedIds: string[],
): boolean {
  return resolveSupportingDocuments(config, verifiedIds).length > 0;
}
