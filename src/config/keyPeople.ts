// ---------------------------------------------------------------------------
// Applicant-declared key people (directors, owners, signatories) — the pure
// half.
//
// Regulators require identifying the natural persons who own or control a
// business. The registry lookup discovers some of them; this is what the
// APPLICANT declares, and a person the applicant omits who the registry then
// names is a risk signal the server flags as `undisclosed`.
// ---------------------------------------------------------------------------

import type { KeyPersonRole } from '../types/business';
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
  role: KeyPersonRole;
  email: string;
  /** The person's own ISO-2 country — a foreign director cannot verify with a
   *  local ID, so this drives their invite's country. */
  country: string;
  ownershipPct: string;
}

export function emptyKeyPerson(role: KeyPersonRole = 'director'): KeyPersonEntry {
  return { name: '', role, email: '', country: '', ownershipPct: '' };
}

/** Whether a row is complete enough to submit. */
export function isKeyPersonRowValid(row: KeyPersonEntry): boolean {
  if (row.name.trim().length < 2) return false;
  if (!KEY_PERSON_ROLES.includes(row.role)) return false;
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
export function invalidKeyPersonRows(rows: KeyPersonEntry[]): number[] {
  return rows
    .map((row, i) => (!isKeyPersonRowBlank(row) && !isKeyPersonRowValid(row) ? i : -1))
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
  email?: string;
  country?: string;
  ownershipPct?: number;
  isApplicant?: boolean;
}> {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isKeyPersonRowValid(row))
    .slice(0, 20)
    .map(({ row, index }) => ({
      name: row.name.trim(),
      role: row.role,
      ...(row.email.trim() !== '' ? { email: row.email.trim() } : {}),
      ...(row.country.trim() !== '' ? { country: row.country.trim().toUpperCase() } : {}),
      ...(row.ownershipPct.trim() !== '' ? { ownershipPct: Number(row.ownershipPct) } : {}),
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
