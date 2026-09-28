// ---------------------------------------------------------------------------
// What the SDK does ON ITS OWN when a flow that collected a presence pin is
// submitted. Until this existed, every observation depended on the host app
// calling reportAddressPresence() or enableBackgroundPresence() itself, and
// companies that wired up the flow and not those calls got watches stuck at
// 0 days / 0 nights until they lapsed (production, 2026-09-28).
//
//   1. Background monitoring, ON unless the workflow sets
//      `presence.background: false`: the SDK asks for the "always" location
//      permission and arms the geofence, so the phone reports stays with the
//      app closed. The primer told the person this prompt was coming. It
//      needs registerBackgroundPresence() at the app's root (a fence without
//      a task defined fires into nothing, so the SDK then skips it) and the
//      host's background-location declarations; without either it degrades
//      to the foreground tier, never an error.
//   2. The first report: the person is standing at the address they just
//      pinned, so the watch gets its first day (and night, when submitted at
//      night) with nothing for the host to do. The reporter waits for the
//      watch the server mints seconds after the submission (watch-wait.ts).
//
// Later days without background monitoring still need the host's reporter on
// app open. Fire-and-forget by contract: never awaited by the flow, never
// throws, and a host that also makes these calls is harmless (arming twice
// re-arms one fence; one day's reports merge into one row).
// Mirrors the Flutter SDK's presence_auto_report.dart.
// ---------------------------------------------------------------------------

import { enableBackgroundPresence, type EnableBackgroundResult } from './background';
import { reportAddressPresence, type ReportPresenceResult } from './report';

export interface AutoReportConfig {
  apiKey: string;
  devUrl?: string;
  userId?: string;
  addressCollection?: { presence?: { enabled?: boolean; background?: boolean } } | null;
}

/** Whether a submitted flow should make the SDK's own presence calls. */
export function shouldAutoReport(config: AutoReportConfig): boolean {
  if (config.addressCollection?.presence?.enabled !== true) return false;
  return typeof config.userId === 'string' && config.userId.trim() !== '';
}

/** Background monitoring is on unless the workflow turns it off. */
export function wantsBackground(config: AutoReportConfig): boolean {
  return shouldAutoReport(config) && config.addressCollection?.presence?.background !== false;
}

export interface AutoReportDeps {
  report?: typeof reportAddressPresence;
  enableBackground?: typeof enableBackgroundPresence;
}

export interface AutoReportOutcome {
  background: EnableBackgroundResult | null;
  report: ReportPresenceResult | null;
}

export async function autoReportPresence(
  config: AutoReportConfig,
  deps: AutoReportDeps = {},
): Promise<AutoReportOutcome | null> {
  if (!shouldAutoReport(config)) return null;
  const options = {
    apiKey: config.apiKey,
    externalUserId: config.userId!,
    ...(config.devUrl ? { devUrl: config.devUrl } : {}),
  };
  // Background first: its permission prompt belongs on the success screen,
  // not a minute later when the report has finished waiting for the watch.
  let background: EnableBackgroundResult | null = null;
  if (wantsBackground(config)) {
    try {
      background = await (deps.enableBackground ?? enableBackgroundPresence)(options);
    } catch {
      background = null;
    }
  }
  let report: ReportPresenceResult | null = null;
  try {
    report = await (deps.report ?? reportAddressPresence)(options);
  } catch {
    report = null;
  }
  return { background, report };
}
