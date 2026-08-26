import type { KeyPersonEntry } from './keyPeople';
import type { KeyPersonRole } from '../types/business';

/**
 * The sectioned key-people model: UBOs / Shareholders / Directors &
 * representatives as VIEWS over one shared list of people.
 *
 * A section is not a bucket. One human is a director AND a 30% owner, and the
 * register files them that way, so an entry appears in every section whose
 * definition it meets — membership is derived from the roles it holds and the
 * stake it declares, never stored. Quick-add grants an existing person another
 * hat instead of retyping them; classification by ownership happens here
 * exactly as the server escalates it, so the screen never disagrees with what
 * the submission will be read as.
 */

export type KeyPeopleSection = 'ubos' | 'shareholders' | 'representatives';

/** Strongest first — the headline role on one-role surfaces. Mirrors the
 *  server's precedence in `key-people/roles.ts`; keep the two in lockstep. */
const ROLE_PRECEDENCE: KeyPersonRole[] = [
  'beneficial_owner',
  'director',
  'signatory',
  'shareholder',
];

export function primaryRole(roles: KeyPersonRole[]): KeyPersonRole {
  for (const role of ROLE_PRECEDENCE) if (roles.includes(role)) return role;
  return 'shareholder';
}

/** The roles an entry actually holds; falls back to the headline for rows
 *  minted before `roles` existed (restored sessions). */
export function rolesOf(entry: Pick<KeyPersonEntry, 'role' | 'roles'>): KeyPersonRole[] {
  return entry.roles && entry.roles.length > 0 ? entry.roles : [entry.role];
}

/** The declared stake as a number, or null when blank/unparseable. */
export function stakeOf(entry: Pick<KeyPersonEntry, 'ownershipPct'>): number | null {
  const raw = entry.ownershipPct.trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Which sections this entry belongs to.
 *
 * - UBOs: a natural person holding the beneficial-owner role OR a stake at or
 *   above the threshold — the same escalation the server performs, so a
 *   shareholder who types 60% moves up on screen exactly as they will in the
 *   submission. A company never qualifies (a beneficial owner is a natural
 *   person in every regime that defines one).
 * - Shareholders: every corporate holder (whatever its stake — the never-a-UBO
 *   rule made visible), plus people with a declared holding or shareholder
 *   role below the threshold. A person the UBO section claimed is not ALSO a
 *   plain shareholder: same stake, one classification.
 * - Representatives: anyone holding director or signatory.
 */
export function sectionsFor(
  entry: KeyPersonEntry,
  threshold: number,
): Set<KeyPeopleSection> {
  const roles = rolesOf(entry);
  const stake = stakeOf(entry);
  const out = new Set<KeyPeopleSection>();

  const isUbo =
    !entry.isCorporate &&
    (roles.includes('beneficial_owner') || (stake != null && stake >= threshold));
  if (isUbo) out.add('ubos');
  if (
    entry.isCorporate ||
    (!isUbo && (roles.includes('shareholder') || (stake != null && stake > 0)))
  ) {
    out.add('shareholders');
  }
  if (roles.includes('director') || roles.includes('signatory')) {
    out.add('representatives');
  }
  return out;
}

/** Indices of the entries each section shows, in list order. */
export function sectionMembers(
  rows: KeyPersonEntry[],
  threshold: number,
): Record<KeyPeopleSection, number[]> {
  const out: Record<KeyPeopleSection, number[]> = {
    ubos: [],
    shareholders: [],
    representatives: [],
  };
  rows.forEach((row, index) => {
    for (const section of sectionsFor(row, threshold)) out[section].push(index);
  });
  return out;
}

/** The role a section's add-tile (and quick-add chip) grants. */
export const SECTION_ROLE: Record<KeyPeopleSection, KeyPersonRole> = {
  ubos: 'beneficial_owner',
  shareholders: 'shareholder',
  representatives: 'director',
};

/**
 * Entries offerable as quick-add chips for a section: already entered, named,
 * not yet a member, and eligible (a company can never be quick-added as a
 * UBO). One tap grants the section's role — the Didit chip, minus its
 * duplicate-name bug.
 */
export function quickAddCandidates(
  rows: KeyPersonEntry[],
  section: KeyPeopleSection,
  threshold: number,
): number[] {
  const members = new Set(sectionMembers(rows, threshold)[section]);
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row, index }) => {
      if (members.has(index)) return false;
      if (row.name.trim().length < 2) return false;
      if (section === 'ubos' && row.isCorporate) return false;
      // Only offer a chip that would DO something. Membership is derived, so
      // granting a role does not always produce it: a beneficial owner is not
      // also a plain shareholder (same stake, one classification), so offering
      // them under Shareholders gave a chip that could be tapped forever and
      // never move anybody. An affordance that does nothing is worse than an
      // absent one, because the applicant concludes the app is broken.
      return sectionsFor(grantRole(row, section), threshold).has(section);
    })
    .map(({ index }) => index);
}

/** Grant an entry another hat (quick-add). The headline follows precedence. */
export function grantRole(entry: KeyPersonEntry, section: KeyPeopleSection): KeyPersonEntry {
  const roles = rolesOf(entry);
  const granted = SECTION_ROLE[section];
  const next = roles.includes(granted) ? roles : [...roles, granted];
  return { ...entry, roles: next, role: primaryRole(next) };
}

/**
 * Take an entry out of a section (the card's X). Removing the section's roles
 * is enough when membership came from them; when it came from a declared
 * stake (or nothing else keeps the row alive) the honest reading of "remove
 * from UBOs" is "remove this person" — the caller deletes the row when this
 * returns null.
 */
export function withoutSection(
  entry: KeyPersonEntry,
  section: KeyPeopleSection,
  threshold: number,
): KeyPersonEntry | null {
  const dropped: KeyPersonRole[] =
    section === 'representatives' ? ['director', 'signatory'] : [SECTION_ROLE[section]];
  const remaining = rolesOf(entry).filter((r) => !dropped.includes(r));
  if (remaining.length === 0) return null;
  const next = { ...entry, roles: remaining, role: primaryRole(remaining) };
  // Still a member by stake? Then role removal did not remove them, and the
  // tap meant more than that.
  if (sectionsFor(next, threshold).has(section)) return null;
  return next;
}

