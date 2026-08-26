/** One declared owner of a corporate key person. */
export interface KeyPersonOwnerEntry {
  name: string;
  /** Their share OF THE COMPANY above. The server multiplies it down the chain. */
  ownershipPct: string;
  email: string;
  country: string;
}

export function emptyKeyPersonOwner(): KeyPersonOwnerEntry {
  return { name: '', ownershipPct: '', email: '', country: '' };
}
