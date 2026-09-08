import type { AddressParts } from '../services/api';
import type { LocationFailure } from '../services/location';

// ---------------------------------------------------------------------------
// The device's current location, fetched ONCE per verification and shared by
// every address step.
//
// Module-level on purpose: the steps mount and unmount as the person walks the
// flow, and re-prompting or re-fixing on every screen is exactly the hesitation
// this exists to remove. Every address step starts the prefetch on mount, so
// the GPS warms up while the person is still reading the SEARCH screen; by the
// pin step the fix — and its reverse-geocoded line — are usually already in
// hand, and the map lands right first time instead of showing a default view
// and then jumping.
//
// A MIRROR of the web SDK's steps/address/current-location.ts, with one
// deliberate difference: web scopes the cache to a PAGE session, which ends at
// the next reload. An app session spans many opens of the SDK, so a fix cached
// an hour ago would drop the pin at yesterday's address. Store CREATION clears
// it (one store per modal launch), making "this verification" the mobile
// equivalent of that scope. Clearing it only from the store's reset() is not
// enough: reset() is a consumer-facing restart, not part of the open path.
// ---------------------------------------------------------------------------

export interface CurrentFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  /** The reverse-geocoded line ("11 Bassey Street, Calabar"), when known. */
  label: string | null;
  parts: AddressParts | null;
}

/** A GPS read: the fix, or WHY there is none (services/location.ts). */
export type FixOutcome =
  | { fix: { lat: number; lng: number; accuracy: number | null } }
  | { failure: LocationFailure };

/**
 * What the cache needs to produce a fix.
 *
 * The GPS reader is INJECTED rather than imported: the store's reset clears
 * this cache, and importing expo-location here would drag a native module into
 * the store's graph for the sake of resetting three variables.
 */
export interface FixSource {
  takeFix(): Promise<FixOutcome>;
  addressReverse(
    lat: number,
    lng: number,
  ): Promise<{ line: string | null; parts?: AddressParts | null }>;
}

let resolved: CurrentFix | null = null;
let inflight: Promise<CurrentFix | null> | null = null;
let failed = false;
let lastFailure: LocationFailure | null = null;

/** Why the last attempt failed, so the message can say something true. */
export function currentFixFailure(): LocationFailure | null {
  return lastFailure;
}

/**
 * The message for a failed read. A refused permission, a phone that cannot
 * place itself, and a fix that took too long are three different problems
 * with three different remedies, and one line telling everybody to "allow
 * location access" sent people to a permission that was already granted.
 * Placing the pin by hand always works, so every line says so. Mirrors the
 * web SDK's locationFailureMessage and Flutter's.
 */
export function locationFailureMessage(reason: LocationFailure | null): string {
  switch (reason) {
    case 'denied':
      return "Location access is blocked for this app. Allow it in your phone's Settings, then try again, or place the pin yourself.";
    case 'unavailable':
      return 'Your phone could not work out where it is right now. Check that location is switched on, then try again, or place the pin yourself.';
    case 'timeout':
      return 'Finding your location took too long. Try again, or place the pin yourself.';
    default:
      return 'This device cannot share its location. Place the pin yourself.';
  }
}

/** The fix, when one has already resolved for this verification. */
export function currentFix(): CurrentFix | null {
  return resolved;
}

/** Is a fix attempt still running? */
export function locating(): boolean {
  return inflight !== null && resolved === null;
}

/**
 * Start (or JOIN) the one location attempt. Safe to call from every address
 * step's mount: the OS permission prompt fires at most once, and a second
 * caller waits on the first attempt rather than starting its own.
 *
 * Resolves null on a denied or failed read — callers fall back to the manual
 * pin, which is what every address failure degrades to.
 */
export function prefetchCurrentFix(
  source: FixSource,
  opts?: { retry?: boolean },
): Promise<CurrentFix | null> {
  if (resolved) return Promise.resolve(resolved);
  // A failed attempt (denied prompt, no fix) is never retried AUTOMATICALLY.
  // Every step mount calls this, so re-arming on failure left the location row
  // spinning forever and re-fired the OS prompt on each screen. An explicit
  // TAP passes `retry` and gets a fresh attempt, since the person may have
  // granted permission in the meantime.
  if (failed && !inflight && !opts?.retry) return Promise.resolve(null);
  if (!inflight) {
    inflight = (async () => {
      // No builder-preview branch: the preview is a web-only surface, and a
      // canned fix here would be a code path no mobile caller can reach.
      const outcome = await source.takeFix().catch((): FixOutcome => ({ failure: 'unsupported' }));
      if (!('fix' in outcome)) {
        inflight = null;
        failed = true;
        lastFailure = outcome.failure;
        return null;
      }
      const fix = outcome.fix;
      lastFailure = null;
      let label: string | null = null;
      let parts: AddressParts | null = null;
      try {
        const r = await source.addressReverse(fix.lat, fix.lng);
        label = r.line ?? null;
        parts = r.parts ?? null;
      } catch {
        /* the coordinates alone are still a fix */
      }
      resolved = { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, label, parts };
      failed = false;
      return resolved;
    })();
  }
  return inflight;
}

/** Forget the fix so the next verification takes its own. Called from the
 *  store's reset, beside the step log. */
export function resetCurrentFix(): void {
  resolved = null;
  inflight = null;
  failed = false;
  lastFailure = null;
}

// ── The pin step's automatic first locate ───────────────────────────────────
//
// Most people are verifying from home, so the map should land on them rather
// than a country-centre default. It fires ONCE: a dismissed or denied prompt
// must not re-fire every time the person passes back through the pin step, and
// the explicit control is there for retries.

let autoLocateAttempted = false;

/** True the FIRST time it is called for a verification, false after. */
export function claimAutoLocate(): boolean {
  if (autoLocateAttempted) return false;
  autoLocateAttempted = true;
  return true;
}

export function resetAutoLocate(): void {
  autoLocateAttempted = false;
}
