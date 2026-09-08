import type { KYCStep } from '../types/config';

// ---------------------------------------------------------------------------
// The address flow as REAL steps: find it (search) → confirm it (pin, with the
// details sheet) → show it (entrance) → commit it (review + attest fix). The
// progress bar advances through them and back/forward is ordinary step
// navigation, not a machine hidden inside one screen. KYB keeps the single
// premises step — its pin + directions ARE the capture, and the KYB flow
// already has its own section rhythm.
//
// 'address-collection' is the PIN step and keeps the original wire name, so
// session progress saved by older builds restores cleanly and the server's
// step-log titles stay meaningful. Do not "fix" it to 'address-pin'.
//
// A MIRROR of the web SDK's steps/address/flow-steps.ts and the Flutter port —
// the same numbers and the same decisions, or one platform strands an
// applicant the others do not. Keep all three in lockstep.
// ---------------------------------------------------------------------------

/**
 * SANDBOX mirrors the web SDK's stubbed vendor treatment (user decision
 * 2026-09-03): placeholder map, canned labels, no search loads — the server's
 * sandbox verdicts are canned anyway, so live vendor calls on test keys spend
 * quota for nothing. DEVELOPMENT keeps the real surfaces (the platform's
 * dev-is-real rule); an unknown environment counts as live.
 */
export function addressVendorsStubbed(facts: { environment?: string | null }): boolean {
  return facts.environment === 'SANDBOX';
}

/** The canned pin label every stubbed surface shows — obviously a sample,
 *  never a real place. Keep in lockstep with the web SDK. */
export const SAMPLE_ADDRESS_LINE = '12 Sample Street, Sample City';

export interface AddressFlowOptions {
  /** A search backend is available AND we are not in builder preview. */
  searchAvailable: boolean;
  /** The entrance-photo mode ('off' hides that capture). */
  photoMode: 'off' | 'optional' | 'required';
  /** Street View framing is offered (workflow on + a browser key in-document). */
  streetViewOffered: boolean;
}

/** The individual flow's address steps, in order. */
export function addressFlowSteps(o: AddressFlowOptions): KYCStep[] {
  const steps: KYCStep[] = [];
  if (o.searchAvailable) steps.push('address-search');
  steps.push('address-collection');
  if (o.photoMode !== 'off' || o.streetViewOffered) steps.push('address-entrance');
  steps.push('address-review');
  return steps;
}

const ADDRESS_STEPS: ReadonlySet<KYCStep> = new Set<KYCStep>([
  'address-search',
  'address-collection',
  'address-entrance',
  'address-review',
]);

/** Whether `step` belongs to the address flow. */
export function isAddressStep(step: KYCStep): boolean {
  return ADDRESS_STEPS.has(step);
}

export function nextAddressStep(steps: KYCStep[], current: KYCStep): KYCStep | null {
  const i = steps.indexOf(current);
  return i >= 0 && i + 1 < steps.length ? steps[i + 1]! : null;
}

export function prevAddressStep(steps: KYCStep[], current: KYCStep): KYCStep | null {
  const i = steps.indexOf(current);
  return i > 0 ? steps[i - 1]! : null;
}

/**
 * Derive the flow options from raw config facts — ONE place, read by the step
 * hook AND the flow-order builder, so the two can never disagree about which
 * screens exist. A mirror of the web SDK's addressFlowOptions.
 *
 * `hasGoogleKey` is always false on mobile (the key describes an in-document
 * browser surface). Street View reaches a phone the same way the framed map
 * does: the hosted /embed/street-view page in a WebView on the app grant,
 * which is `hasStreetViewFrame` — the server minted a maps frame URL AND
 * `react-native-webview` is installed. Absent either, the entrance step is
 * photo-only, exactly as it was before 2026-09-06.
 */
export function addressFlowOptions(facts: {
  photo?: 'off' | 'optional' | 'required';
  streetView?: 'off' | 'optional' | 'required';
  serverSearch: boolean;
  previewMode: boolean;
  hasGoogleKey: boolean;
  /** A maps frame URL this install can render: the framed
   *  /embed/street-view page carries the panorama for it. */
  hasStreetViewFrame: boolean;
}): AddressFlowOptions {
  const photoMode = facts.photo ?? 'optional';
  return {
    searchAvailable: facts.serverSearch && !facts.previewMode,
    photoMode,
    // ON by default: offered unless the workflow opted out, and wherever a
    // Google surface exists.
    streetViewOffered:
      facts.streetView !== 'off' && (facts.hasGoogleKey || facts.hasStreetViewFrame),
  };
}

/** Great-circle metres between two points (small-distance haversine). */
export function metersBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * A map settle within about a metre of the current pin is the tile roundtrip
 * drifting, not a move. Acting on it rebuilt the address WITHOUT its label, and
 * the reverse geocoder then overwrote a searched-and-picked address with the
 * area line. BOTH axes must be inside the epsilon for a move to be ignored.
 */
export const PIN_EPSILON = 1e-5;

/**
 * How far a pin may move from the spot a label was PICKED for before the label
 * stops credibly naming it. The pick names the property; the nudge refines
 * where its roof is — same scale as the server's at-address tolerance. Beyond
 * this, keeping the picked name would be a lie.
 */
export const KEEP_PICKED_LABEL_RADIUS_M = 250;

/** Below this, a pin move is roof refinement — keep the picked label silently;
 *  asking would be noise. */
export const LABEL_PROMPT_MIN_MOVE_M = 25;

/** Debounce before reverse-geocoding a moved pin. */
export const REVERSE_DEBOUNCE_MS = 700;

/** Places autocomplete: debounce, and the floor below which nothing is asked. */
export const AUTOCOMPLETE_DEBOUNCE_MS = 300;
export const SEARCH_MIN_QUERY_LENGTH = 3;

/**
 * Whether the pin screen should ASK "keep the selected address?" — the
 * applicant decides the label's fate, never a silent discard. Ask once past the
 * refinement threshold; a prior "keep" stands until the pin crosses the
 * credibility radius, where setPin resets it so the question returns exactly
 * once. A DERIVED label (no pickedAt anchor) is never questioned: those
 * re-derive freely on every move.
 */
export function shouldAskLabelDecision(address: {
  lat: number;
  lng: number;
  label?: string;
  pickedAt?: { lat: number; lng: number };
  labelKept?: boolean;
}): boolean {
  if (!address.pickedAt || !address.label || address.labelKept) return false;
  return metersBetween(address.pickedAt, address) > LABEL_PROMPT_MIN_MOVE_M;
}

// The displayed address line lives next door (200-line rule), re-exported so
// every importer of this file keeps working.
export { displayAddressLine } from './address-line';
