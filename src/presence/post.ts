// ---------------------------------------------------------------------------
// The one wire path for presence observations — shared by the foreground
// reporter and the background geofence flush, so the two tiers can never
// drift on the request shape. Best-effort by contract: a failure returns
// false and the caller keeps its queue.
// ---------------------------------------------------------------------------

import { resolveBaseUrl } from '../services/resolveUrl';

export interface WireObservation {
  day: string;
  source: 'geofence' | 'foreground';
  dwellMinutes: number;
  nightPresent: boolean;
  samples: number;
  integrity?: { mockLocation?: boolean; emulator?: boolean };
}

export async function postObservations(
  apiKey: string,
  devUrl: string | undefined,
  externalUserId: string,
  observations: WireObservation[],
): Promise<boolean> {
  if (observations.length === 0) return true;
  try {
    const base = resolveBaseUrl(apiKey, devUrl);
    const response = await fetch(`${base}/api/kyc/address/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ externalUserId, observations }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
