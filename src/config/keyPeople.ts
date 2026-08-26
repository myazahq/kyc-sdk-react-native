// ---------------------------------------------------------------------------
// Applicant-declared key people (directors, owners, signatories) — the pure
// half.
//
// Regulators require identifying the natural persons who own or control a
// business. The registry lookup discovers some of them; this is what the
// APPLICANT declares, and a person the applicant omits who the registry then
// names is a risk signal the server flags as `undisclosed`.
// ---------------------------------------------------------------------------

export { looksCorporate } from './keyPeopleCorporate';
import { ownersPayload } from './keyPeopleOwners';
export { emptyKeyPersonOwner } from './keyPeopleOwnerTypes';
export type { KeyPersonOwnerEntry } from './keyPeopleOwnerTypes';
import type { KeyPersonOwnerEntry } from './keyPeopleOwnerTypes';
import type { KeyPersonRole, WorkflowBusinessConfig } from '../types/business';
import { isValidContactEmail } from './contact';

/** UI cap on applicant-entered rows (the server accepts ≤20). */
export const MAX_KEY_PEOPLE_ROWS = 10;

export const KEY_PERSON_ROLE_LABELS: Record<KeyPersonRole, string> = {
  director: 'Director',
  beneficial_owner: 'Beneficial owner (UBO)',
  signatory: 'Signatory',
  shareholder: 'Shareholder',
};

export const KEY_PERSON_ROLES: KeyPersonRole[] = [
  'director',
  'beneficial_owner',
  'signatory',
  'shareholder',
];

/** One row as typed. Everything is a string so a half-filled row is editable. */
export interface KeyPersonEntry {
  name: string;
  /** The headline role — derived from `roles` by precedence (mirrors the
   *  server's role/roles pair). One-role surfaces read it. */
  role: KeyPersonRole;
  /** Every hat this person wears: a director AND a 30% owner is one human,
   *  filed twice — never two entries. Never empty. */
  roles: KeyPersonRole[];
  /** Their own words for the position ("CFO, Board Member"). Display only. */
  title: string;
  email: string;
  /** The person's own ISO-2 country — a foreign director cannot verify with a
   *  local ID, so this drives their invite's country. */
  country: string;
  ownershipPct: string;
  /**
   * This party is a company, not a person.
   *
   * A company can never be a beneficial owner, so it is screened as an entity
   * and never asked to verify an identity it does not have. Saying so is what
   * stops the flow sending a document-and-selfie link to a limited company and
   * then waiting for it.
   */
  isCorporate: boolean;
  /** A corporate party's own registration number, as typed. */
  registrationNumber: string;
  /**
   * The people who own a corporate party, as the applicant knows them. The only
   * route to the humans above a parent no register we serve can be asked about.
   */
  owners: KeyPersonOwnerEntry[];
}

export function emptyKeyPerson(role: KeyPersonRole = 'director'): KeyPersonEntry {
  return {
    name: '',
    role,
    roles: [role],
    title: '',
    email: '',
    country: '',
    ownershipPct: '',
    isCorporate: false,
    registrationNumber: '',
    owners: [],
  };
}


const EMPTY_ROLES: ReadonlySet<KeyPersonRole> = new Set();

/**
 * The roles whose EMAIL is mandatory: the ones that are actually sent a
 * verification link. Asking a screening-only signatory for an address blocks
 * the form over a field nothing will read. Mirrors the web SDK's
 * keyPeopleRequireEmail — keep the two in lockstep.
 */
export function keyPeopleRequireEmail(
  business: WorkflowBusinessConfig | undefined,
): Set<KeyPersonRole> {
  const kp = business?.keyPeople;
  if (!kp?.enabled || !kp.collect || !kp.requireEmail) return new Set();
  if (kp.requireEmailRoles?.length) return new Set(kp.requireEmailRoles);
  return new Set(
    KEY_PERSON_ROLES.filter(
      (r) => (kp.perRole?.[r] ?? kp.level ?? 'screening_only') === 'full_kyc',
    ),
  );
}

/** Whether THIS row must carry an email. A company has no inbox and is never
 *  invited, so a corporate row is always exempt. */
export function rowNeedsEmail(
  row: KeyPersonEntry,
  emailRequiredFor: ReadonlySet<KeyPersonRole>,
): boolean {
  const roles = row.roles && row.roles.length > 0 ? row.roles : [row.role];
  return !row.isCorporate && roles.some((r) => emailRequiredFor.has(r));
}

/**
 * Whether a row is complete enough to submit.
 *
 * `emailRequiredFor` makes the address mandatory rather than merely
 * well-formed. The server enforces it too, but only at SUBMIT — several steps
 * later, as a generic failure, with no way back to the row that is missing
 * one. Blocking here is where the person can still fix it.
 */
export function isKeyPersonRowValid(
  row: KeyPersonEntry,
  emailRequiredFor: ReadonlySet<KeyPersonRole> = EMPTY_ROLES,
): boolean {
  if (row.name.trim().length < 2) return false;
  const roles = row.roles && row.roles.length > 0 ? row.roles : [row.role];
  if (!roles.every((r) => KEY_PERSON_ROLES.includes(r))) return false;
  if (rowNeedsEmail(row, emailRequiredFor) && row.email.trim() === '') return false;
  if (row.email.trim() !== '' && !isValidContactEmail(row.email.trim())) return false;
  if (row.ownershipPct.trim() !== '') {
    const pct = Number(row.ownershipPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return false;
  }
  return true;
}

/**
 * A blank row is not an error — it is a row the user started and abandoned, and
 * it is simply dropped. Only a row with SOMETHING in it can be invalid.
 */
export function isKeyPersonRowBlank(row: KeyPersonEntry): boolean {
  return (
    row.name.trim() === '' &&
    row.email.trim() === '' &&
    row.country.trim() === '' &&
    row.ownershipPct.trim() === ''
  );
}

/** Rows the user has begun but not made valid — what blocks Continue. */
export function invalidKeyPersonRows(
  rows: KeyPersonEntry[],
  emailRequiredFor: ReadonlySet<KeyPersonRole> = EMPTY_ROLES,
): number[] {
  return rows
    .map((row, i) =>
      !isKeyPersonRowBlank(row) && !isKeyPersonRowValid(row, emailRequiredFor) ? i : -1,
    )
    .filter((i) => i >= 0);
}

/**
 * The valid rows, in the shape the verify payload wants. `applicantIndex`
 * (into the UNfiltered `rows`) flags the entry the applicant picked as
 * themselves — the server merges it with the applicant row so one human
 * never becomes two KeyPerson records (one KYC, one screening, no invite).
 */
export function keyPeoplePayload(
  rows: KeyPersonEntry[],
  applicantIndex: number | null = null,
): Array<{
  name: string;
  role: KeyPersonRole;
  roles: KeyPersonRole[];
  title?: string;
  email?: string;
  country?: string;
  ownershipPct?: number;
  isCorporate?: boolean;
  registrationNumber?: string;
  owners?: Array<{ name: string; ownershipPct?: number; email?: string; country?: string }>;
  isApplicant?: boolean;
}> {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isKeyPersonRowValid(row))
    .slice(0, 20)
    .map(({ row, index }) => ({
      name: row.name.trim(),
      role: row.role,
      // Every hat they wear - the server merges the set with its own
      // ownership escalation and derives the headline by precedence.
      roles: row.roles && row.roles.length > 0 ? row.roles : [row.role],
      ...(row.title?.trim() ? { title: row.title.trim() } : {}),
      ...(row.email.trim() !== '' ? { email: row.email.trim() } : {}),
      ...(row.country.trim() !== '' ? { country: row.country.trim().toUpperCase() } : {}),
      ...(row.ownershipPct.trim() !== '' ? { ownershipPct: Number(row.ownershipPct) } : {}),
      // A company cannot also be the person filling in the form, so the
      // applicant's own entry is never sent as one.
      ...(row.isCorporate && index !== applicantIndex ? { isCorporate: true } : {}),
      ...(row.isCorporate && row.registrationNumber.trim() !== ''
        ? { registrationNumber: row.registrationNumber.trim() }
        : {}),
      ...(row.isCorporate && index !== applicantIndex ? ownersPayload(row.owners) : {}),
      ...(index === applicantIndex ? { isApplicant: true } : {}),
    }));
}

/** "Richard Ingwe" → "RI" — the avatar monogram used on person cards. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('');
}

/** Split a typed full name into first/last (best-effort). */
export function splitFullName(name: string): { firstName?: string; lastName?: string } | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return { firstName, ...(rest.length > 0 ? { lastName: rest.join(' ') } : {}) };
}

/**
 * Loose "is this the same person?" match used ONLY to PRE-SELECT the
 * applicant's own entry on the applicant-role step (from the consumer's
 * userData). Every token of the shorter name must appear in the longer one,
 * so "Richard Ingwe" matches "Richard A. Ingwe" but never "Jane Ingwe". The
 * user still confirms explicitly — this never merges anything by itself.
 */
export function namesLooselyMatch(a: string, b: string): boolean {
  const tokens = (s: string): string[] =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return shorter.every((t) => longer.includes(t));
}

/**
 * The self-selected key person's ID-issuing country (uppercase ISO-2), when
 * the applicant picked themselves AND that entry carries one. The applicant
 * leg then SKIPS the country-select step — they already answered "where was
 * your ID issued?" on the key-people step.
 */
export function applicantSelfCountry(app: {
  keyPeople: KeyPersonEntry[];
  applicantKeyPersonIndex: number | null;
}): string | null {
  if (app.applicantKeyPersonIndex === null) return null;
  const country = app.keyPeople[app.applicantKeyPersonIndex]?.country.trim();
  return country ? country.toUpperCase() : null;
}
