import { NitroModules } from 'react-native-nitro-modules';

import type { MyazaEmrtd } from '../specs/MyazaEmrtd.nitro';

// ---------------------------------------------------------------------------
// Resolving the native eMRTD module, and the capability questions that only it
// can answer. The read loop lives in read.ts; this file owns the registry
// lookup so both have one source of truth for "is there a native side at all".
// ---------------------------------------------------------------------------

/**
 * The native module, resolved LAZILY and re-tried until it appears.
 *
 * It used to be created at module load. That is fragile in a way that fails
 * SILENTLY and permanently: if this module happens to evaluate before Nitro's
 * registry is populated — which Fast Refresh causes routinely — the reference
 * is null for the rest of the session, `isNfcAvailable()` reports false, and
 * the chip step quietly skips itself. Nothing logs, and the flow looks like a
 * device without an NFC radio.
 *
 * Resolving on demand costs one registry lookup and cannot get stuck.
 */
let cached: MyazaEmrtd | null = null;
export function nativeModule(): MyazaEmrtd | null {
  if (cached) return cached;
  try {
    if (!NitroModules.hasHybridObject('MyazaEmrtd')) return null;
    cached = NitroModules.createHybridObject<MyazaEmrtd>('MyazaEmrtd');
    return cached;
  } catch {
    return null;
  }
}

/**
 * Why NFC is unavailable, when it is.
 *
 * Two very different failures both surface as "no NFC": the Nitro registry not
 * having the object yet (a JS-side race, recoverable — a retry moments later
 * succeeds), and the device/entitlement genuinely not supporting reads (final).
 * Collapsing them into one boolean sent debugging to the wrong layer once
 * already, so the distinction is reported.
 */
export function nfcUnavailableReason(): 'module_not_registered' | 'device_unsupported' | null {
  try {
    const mod = nativeModule();
    if (!mod) return 'module_not_registered';
    return mod.isAvailable() ? null : 'device_unsupported';
  } catch {
    return 'module_not_registered';
  }
}

/**
 * Decode an image the JS side cannot render, returning base64 JPEG.
 *
 * Used for JPEG 2000 chip portraits (DG2), which React Native has no decoder
 * for. Null when the platform declines the format — the preview is a courtesy
 * and the chip read stands without it.
 */
export async function decodeChipImage(dataBase64: string): Promise<string | null> {
  try {
    // The native side reports "could not decode" as an empty string; normalise
    // it to null so callers have one absent value to check.
    const jpeg = await nativeModule()?.decodeImage(dataBase64);
    return jpeg ? jpeg : null;
  } catch {
    return null;
  }
}

/** Whether this build and device can read a chip at all. */
export function isNfcAvailable(): boolean {
  try {
    return nativeModule()?.isAvailable() ?? false;
  } catch {
    return false;
  }
}
