// ---------------------------------------------------------------------------
// Presence math — the pure half of the foreground reporter. On-device
// evaluation is the contract: the phone decides "inside the fence?" and "what
// local day/night is it?", and only the derived record (day + flag) ever
// leaves the device. Raw coordinates never travel after capture.
//
// Mirrors the Flutter SDK's presence_math.dart — keep the two in lockstep.
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** The server's at-address rule, applied on-device: 250 m, widened to the
 *  fix's reported accuracy, capped at 1 km. */
export function insideFence(
  pin: { lat: number; lng: number },
  fix: { lat: number; lng: number; accuracy: number | null },
): boolean {
  const radius = Math.min(1000, Math.max(250, fix.accuracy ?? 0));
  return haversineMeters(pin.lat, pin.lng, fix.lat, fix.lng) <= radius;
}

/** The observation's day + night flag, from the DEVICE's local clock — that is
 *  the whole point of on-device evaluation. Night = 20:00–05:59 local. */
export function localDayAndNight(now = new Date()): { day: string; nightPresent: boolean } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const hour = now.getHours();
  return { day, nightPresent: hour >= 20 || hour < 6 };
}
