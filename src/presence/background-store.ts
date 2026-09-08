// Persistence for the background geofence tier: the open ENTER timestamp,
// the unflushed per-day queue, and the wire config the headless task needs
// (it runs with no React context, so apiKey/devUrl are persisted beside the
// pin — the key is publishable by design). Kept apart from the pin store so
// each file stays small and the pin's own lifecycle rules stay untangled
// from flush bookkeeping.

import { readJsonFile, writeJsonFile } from './fs';
import type { WireObservation } from './post';

const FILE_NAME = 'myaza-kyc-presence-bg.json';

interface BgRecord {
  enterAt?: number | null;
  pending?: WireObservation[];
  config?: { apiKey: string; devUrl?: string };
  serviceUser?: string;
}

/** The foreground-service tier serves ONE user at a time (one notification,
 *  one location stream), and its task carries no region identifier the way a
 *  geofence event does — so the user it samples for is remembered under this
 *  reserved key, which no org user reference can collide with. */
const SERVICE_USER_KEY = '__service_user__';

function readAll(): Record<string, BgRecord> {
  return readJsonFile(FILE_NAME) as Record<string, BgRecord>;
}

function write(userId: string, patch: Partial<BgRecord>): void {
  const all = readAll();
  all[userId] = { ...all[userId], ...patch };
  writeJsonFile(FILE_NAME, all as Record<string, unknown>);
}

export function saveEnterAt(userId: string, at: number | null): void {
  write(userId, { enterAt: at });
}

export function loadEnterAt(userId: string): number | null {
  const at = readAll()[userId]?.enterAt;
  return typeof at === 'number' ? at : null;
}

export function pendingObservations(userId: string): WireObservation[] {
  const pending = readAll()[userId]?.pending;
  return Array.isArray(pending) ? pending : [];
}

export function replacePending(userId: string, next: WireObservation[]): void {
  write(userId, { pending: next });
}

/** Append fresh aggregates through the caller's merge (same-day spans fold). */
export function queueObservations(
  userId: string,
  fresh: WireObservation[],
  merge: (existing: WireObservation[], fresh: WireObservation[]) => WireObservation[],
): void {
  write(userId, { pending: merge(pendingObservations(userId), fresh) });
}

export function saveReporterConfig(userId: string, config: { apiKey: string; devUrl?: string }): void {
  write(userId, { config });
}

export function loadReporterConfig(userId: string): { apiKey: string; devUrl?: string } | null {
  const cfg = readAll()[userId]?.config;
  return cfg && typeof cfg.apiKey === 'string' ? cfg : null;
}

export function saveServiceUser(userId: string | null): void {
  const all = readAll();
  if (userId == null) delete all[SERVICE_USER_KEY];
  else all[SERVICE_USER_KEY] = { serviceUser: userId };
  writeJsonFile(FILE_NAME, all as Record<string, unknown>);
}

export function loadServiceUser(): string | null {
  const id = readAll()[SERVICE_USER_KEY]?.serviceUser;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
