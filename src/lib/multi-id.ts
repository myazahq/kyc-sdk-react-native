// Multi-ID flows on React Native. A PORT of the web SDK's lib/multi-id.ts,
// kept byte-for-byte in its logic: the server validates the pick sequence the
// client produced, so a client that computes options differently produces
// submissions the server rejects. If you change a rule here, change it in
// kyc-sdk-react/src/lib/multi-id.ts, kyc-core/src/lib/multi-id.ts and the
// dashboard's required-ids-model.ts in the same commit.
//
// Multi-ID flows: a workflow's `multiId` block asks for SEVERAL ID checks in
// one run — the applicant picks each slot's ID from what the admin allowed for
// THEIR country (a picked ID disappears from later slots), ONE selfie covers
// the whole run, and everything submits as ONE verification the server judges
// by the pass policy.
//
// Multi-region works: the country-select step comes first as usual, and the
// run then walks THAT country's slots (`countries[].multiIdSlots`). The pure
// helpers here MIRROR the server's lib/multi-id.ts exactly — the safe-options
// rule is what keeps an applicant from ever being offered a pick that would
// strand a later slot, and the server validates the same sequence.

export interface MultiIdConfig {
  count: number;
  minPassed: number;
}

export interface MultiIdCountry {
  country: string;
  idTypes?: string[];
  /** This country's per-verification ID allowlists. */
  multiIdSlots?: Array<{ idTypes?: string[] }>;
}

interface MultiIdSourceConfig {
  multiId?: MultiIdConfig;
  subjectType?: string;
  /** The EFFECTIVE country (post country-select) — whose slots the run walks. */
  country?: string;
  countries?: MultiIdCountry[];
  idTypes?: string[];
}

/** The workflow's multiId POLICY — null for ordinary flows and every KYB flow. */
export function multiIdConfigFrom(config: MultiIdSourceConfig): MultiIdConfig | null {
  if (config.subjectType === 'business') return null;
  const block = config.multiId;
  if (!block || typeof block.count !== 'number') return null;
  const count = Math.trunc(block.count);
  // REJECT an out-of-range count rather than clamping it. The server returns
  // null here, so clamping made the client walk 3 checks for a config the
  // server does not consider multi-ID at all — and clamping `minPassed`
  // against the RAW count could ask for 9 of 3 to pass, which nothing can
  // satisfy. Same rule, both sides, or the client builds submissions the
  // server rejects.
  if (!Number.isInteger(count) || count < 2 || count > 3) return null;
  return {
    count,
    minPassed:
      typeof block.minPassed === 'number' && Number.isInteger(block.minPassed)
        ? Math.min(Math.max(block.minPassed, 1), count)
        : count,
  };
}

/** The country entry the run walks: the EFFECTIVE country's, else the legacy
 *  single-country shape. */
export function multiIdCountryEntry(config: MultiIdSourceConfig): MultiIdCountry | null {
  const country = config.country;
  if (config.countries && config.countries.length > 0) {
    return config.countries.find((c) => c.country === country) ?? null;
  }
  return country ? { country, idTypes: config.idTypes } : null;
}

/**
 * The ID types the picked country offers: its pinned list, else everything the
 * server granted there.
 */
export function multiIdOfferedTypes(
  config: MultiIdSourceConfig,
  serverIdTypes: Array<{ country: string; idType: string }>,
): string[] {
  const entry = multiIdCountryEntry(config);
  if (!entry) return [];
  if (entry.idTypes && entry.idTypes.length > 0) return entry.idTypes;
  return serverIdTypes.filter((row) => row.country === entry.country).map((row) => row.idType);
}

/** Per-slot option lists (a pinned slot keeps its list; others offer everything). */
export function multiIdSlotOptions(
  count: number,
  slots: Array<{ idTypes?: string[] }> | undefined,
  offered: string[],
): string[][] {
  const offeredSet = new Set(offered);
  return Array.from({ length: count }, (_, i) => {
    const pinned = slots?.[i]?.idTypes;
    const base = pinned && pinned.length > 0 ? pinned : offered;
    return base.filter((t) => offeredSet.has(t));
  });
}

/** The first reachable dead-end across pick orders, or null. */
export function multiIdFirstDeadEnd(
  slotOptions: string[][],
): { picks: string[]; slotIndex: number } | null {
  const walk = (index: number, picked: string[]): { picks: string[]; slotIndex: number } | null => {
    if (index >= slotOptions.length) return null;
    const available = slotOptions[index]!.filter((t) => !picked.includes(t));
    if (available.length === 0) return { picks: picked, slotIndex: index };
    for (const pick of available) {
      const deadEnd = walk(index + 1, [...picked, pick]);
      if (deadEnd) return deadEnd;
    }
    return null;
  };
  return walk(0, []);
}

/** The picks a slot may SAFELY offer: unused AND non-stranding. */
export function multiIdSafeOptions(
  slotOptions: string[][],
  slotIndex: number,
  picked: string[],
): string[] {
  const remaining = slotOptions.slice(slotIndex + 1);
  return (slotOptions[slotIndex] ?? [])
    .filter((t) => !picked.includes(t))
    .filter(
      (t) =>
        multiIdFirstDeadEnd(
          remaining.map((opts) => opts.filter((o) => o !== t && !picked.includes(o))),
        ) === null,
    );
}

export interface MultiIdPlan {
  count: number;
  minPassed: number;
  /** Which slot is being walked (clamped; equals count once every slot committed). */
  index: number;
  /** The current slot is the final one. */
  last: boolean;
  /** ID types committed so far, in order. */
  picked: string[];
  /** What the CURRENT slot's picker may offer. */
  safeOptions: string[];
}

/** The active plan, or null for ordinary flows. */
export function multiIdPlan(
  config: MultiIdSourceConfig,
  state: { multiIdSlotIndex: number; multiIdSlots: Array<{ idType: string }> },
  serverIdTypes: Array<{ country: string; idType: string }>,
): MultiIdPlan | null {
  const cfg = multiIdConfigFrom(config);
  if (!cfg) return null;
  const offered = multiIdOfferedTypes(config, serverIdTypes);
  const options = multiIdSlotOptions(cfg.count, multiIdCountryEntry(config)?.multiIdSlots, offered);
  const picked = state.multiIdSlots.map((s) => s.idType);
  const index = Math.min(Math.max(state.multiIdSlotIndex, 0), cfg.count);
  return {
    count: cfg.count,
    minPassed: cfg.minPassed,
    index,
    last: index >= cfg.count - 1,
    picked,
    safeOptions: index < cfg.count ? multiIdSafeOptions(options, index, picked) : [],
  };
}

/** Which evidence step one slot's ID opens on. */
export function multiIdEvidenceStep(
  def: { requiresDocumentCapture: boolean } | null | undefined,
): 'id-input' | 'document-capture' {
  return def && def.requiresDocumentCapture === false ? 'id-input' : 'document-capture';
}

/**
 * The committed slots as the WIRE sees them — an explicit whitelist, because
 * the slots also carry local preview images for the back journey and those must
 * never reach the submission or the session-progress blob. Whitelist, not
 * spread: a field added to the slot later cannot leak by default.
 */
export function multiIdWireSlots(
  slots: Array<{
    idType: string;
    idNumber?: string;
    documentFront?: string;
    documentBack?: string;
    documentFrontVideo?: string;
    documentBackVideo?: string;
  }>,
): Array<{
  idType: string;
  idNumber?: string;
  documentFront?: string;
  documentBack?: string;
  documentFrontVideo?: string;
  documentBackVideo?: string;
}> {
  // The chip is attached by the caller after this whitelist (it is a payload,
  // not a mediaId), so it is absent here and not stripped.
  return slots.map((s) => ({
    idType: s.idType,
    ...(s.idNumber ? { idNumber: s.idNumber } : {}),
    ...(s.documentFront ? { documentFront: s.documentFront } : {}),
    ...(s.documentBack ? { documentBack: s.documentBack } : {}),
    ...(s.documentFrontVideo ? { documentFrontVideo: s.documentFrontVideo } : {}),
    ...(s.documentBackVideo ? { documentBackVideo: s.documentBackVideo } : {}),
  }));
}
