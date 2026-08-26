import type { KeyPersonOwnerEntry } from './keyPeopleOwnerTypes';

// The people an applicant says own a corporate shareholder. Declared,
// corroborated by nothing, and recorded as exactly that.

/** Declared owners, dropping the half-typed rows. Absent when none are valid. */
export function ownersPayload(
  owners: KeyPersonOwnerEntry[] | undefined,
): { owners?: Array<{ name: string; ownershipPct?: number; email?: string; country?: string }> } {
  const valid = (owners ?? [])
    .filter((o) => o.name.trim().length >= 2)
    .slice(0, 10)
    .map((o) => {
      const pct = Number(o.ownershipPct);
      return {
        name: o.name.trim(),
        ...(o.ownershipPct.trim() !== '' && Number.isFinite(pct) && pct >= 0 && pct <= 100
          ? { ownershipPct: pct }
          : {}),
        ...(o.email.trim() !== '' ? { email: o.email.trim() } : {}),
        ...(o.country.trim() !== '' ? { country: o.country.trim().toUpperCase() } : {}),
      };
    });
  return valid.length > 0 ? { owners: valid } : {};
}

