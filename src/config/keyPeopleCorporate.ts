// Telling a company apart from a person in a register's officer list.

/**
 * Corporate designators, matched only at the END of a name.
 *
 * End-anchored on purpose: "Trust", "Grace" and "Precious" are ordinary
 * Nigerian given names, and nobody is called "X Limited".
 */
const CORPORATE_SUFFIXES = [
  'limited', 'ltd', 'plc', 'inc', 'incorporated', 'llc', 'llp', 'gmbh', 'nv', 'bv', 'pty',
  'corporation', 'corp', 'nominees', 'holdings', 'trustees', 'ventures', 'enterprises',
];

/** Whether a registry name reads as a company. */
export function looksCorporate(name: string): boolean {
  const parts = name.toLowerCase().replace(/[.,()]/g, ' ').split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  return last != null && CORPORATE_SUFFIXES.includes(last);
}
