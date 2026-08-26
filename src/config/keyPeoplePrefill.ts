import type { KeyPersonEntry } from './keyPeople';
import type { KeyPersonRole } from '../types/business';
import { looksCorporate } from './keyPeopleCorporate';
import { primaryRole } from './keyPeopleSections';
import type { RegistryOfficer } from '../services/api';

// ---------------------------------------------------------------------------
// Turning the register's officer list into rows the applicant confirms.
//
// This is the whole point of checking at selection: the question stops being
// "who are your directors?", which is a memory test, and becomes "are these
// right?", which is a confirmation. It also makes a removal meaningful —
// taking a name out of a list you were shown is a decision, and the server
// records it as one (keyPeople.removedFromRegistry).
//
// Ported from the web SDK's key-people-prefill.ts — keep the two in lockstep.
// ---------------------------------------------------------------------------

/**
 * People a register names who are not parties to the business: the agent who
 * filed the papers, the witness to a signature, the lawyer who drew them up,
 * the deponent who swore the declaration. Prefilled as directors, an applicant
 * confirming what looked like their own board would hand us the filing agent
 * as an officer.
 */
/** The closed role vocabulary a served role must belong to. */
const VALID_ROLES: KeyPersonRole[] = ['director', 'beneficial_owner', 'signatory', 'shareholder'];

const NOT_A_PARTY = ['presenter', 'witness', 'lawyer', 'deponent', 'solicitor', 'notary'];

/**
 * A registry designation in our role vocabulary.
 *
 * Falls back to `director` rather than dropping a person: an officer we cannot
 * classify still has to appear, because an unlisted one reads as an omission.
 */
export function roleFromDesignation(designation: string | null): KeyPersonRole {
  const d = (designation ?? '').toLowerCase();
  // Nigeria's beneficial-ownership register, in CAMA 2020's own words.
  if (d.includes('significant control') || d.includes('psc') || d.includes('beneficial')) {
    return 'beneficial_owner';
  }
  if (d.includes('shareholder') || d.includes('owner') || d.includes('member')) return 'shareholder';
  if (d.includes('secretary') || d.includes('signator')) return 'signatory';
  return 'director';
}

/**
 * Two spellings of one name: enough shared words, and no CONFLICT.
 *
 * Counting shared words alone merged siblings — a double-barrelled family
 * surname supplies two shared words by itself. Each side holding a word the
 * other lacks is a different person; one side holding extras is the fuller
 * spelling. Mirrors the server's namesLikelySame.
 */
function samePerson(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 2),
    );
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  if (shared === 1 && Math.min(wa.size, wb.size) === 1) return true;
  if (shared < 2) return false;
  return shared === wa.size || shared === wb.size;
}

/**
 * Build the rows to start the step with.
 *
 * ONE ROW PER PERSON: a register files one designation per entry and the same
 * human several times over, so entries are merged by name, keeping the
 * classification that asks the most of them.
 */
export function prefillKeyPeople(
  officers: readonly RegistryOfficer[],
  defaultCountry: string,
): KeyPersonEntry[] {
  const rows: KeyPersonEntry[] = [];
  for (const o of officers) {
    const name = (o.name ?? '').trim();
    if (!name) continue;
    const d = (o.designation ?? '').toLowerCase();
    if (NOT_A_PARTY.some((h) => d.includes(h))) continue;

    // A newer server sends the merged role set; an older one sends the raw
    // designation per entry and the merge below reassembles the person.
    const served = (o.roles ?? []).filter((r): r is KeyPersonRole =>
      VALID_ROLES.includes(r as KeyPersonRole),
    );
    const roles = served.length > 0 ? served : [roleFromDesignation(o.designation)];
    const existing = rows.find((r) => samePerson(r.name, name));
    if (existing) {
      // The register filed the same human under another designation - that is
      // another HAT, not another person. Union the roles; the headline keeps
      // the classification that asks the most of them.
      existing.roles = [...new Set([...existing.roles, ...roles])];
      existing.role = primaryRole(existing.roles);
      if (name.length > existing.name.length) existing.name = name;
      continue;
    }
    rows.push({
      name,
      role: primaryRole(roles),
      roles,
      title: '',
      // Fill what the register actually said - the ownership split it
      // computed from the share counts, an email when one is on file - and
      // invent nothing: a value it did not give stays for the applicant.
      email: (o.email ?? '').trim(),
      country: defaultCountry,
      ownershipPct:
        o.ownershipPct != null && Number.isFinite(o.ownershipPct)
          ? String(o.ownershipPct)
          : '',
      isCorporate: o.isCorporate ?? looksCorporate(name),
      registrationNumber: (o.registrationNumber ?? '').trim(),
      owners: [],
    });
  }
  return rows;
}

/**
 * Whether prefilling would overwrite work. Only ever fills an empty list:
 * someone who already typed a name has told us something the register did
 * not, and replacing it would lose both their input and the signal in it.
 */
export function shouldPrefill(existing: readonly KeyPersonEntry[]): boolean {
  return existing.every((r) => r.name.trim() === '' && r.email.trim() === '');
}
