// ---------------------------------------------------------------------------
// The reporter switches background monitoring on for people already being
// checked.
//
// The SDK arms the background tier once, right after a verification is
// submitted (auto-report.ts). Someone verified before the SDK did that, or on
// an always-on arrangement whose renewals never run the flow again, never
// passes that moment: their check collected app-open reports only. The one
// SDK call their app already makes is the reporter, so the reporter arms it.
//
// The rule (`shouldArmBackground`) is pure. It mirrors the Flutter SDK's
// presence_auto_arm.dart; change both together.
// ---------------------------------------------------------------------------

import * as Location from 'expo-location';
import {
  backgroundPresenceRegistered,
  enableBackgroundPresence,
  type EnableBackgroundResult,
} from './background';
import { geofenceArmed } from './geofence';
import { markBackgroundAsked, type StoredPin } from './store';
import type { WatchState } from './watch-wait';

export interface ArmInputs {
  /** The host passed `autoBackground: false`. */
  optedOut: boolean;
  /** The pin was saved moments ago: the flow's own submit step arms it. */
  fresh: boolean;
  pin: Pick<StoredPin, 'alwaysOn' | 'background' | 'backgroundAsked'>;
  /** The server's word on the check, or null when it could not be read. */
  watch: WatchState | null;
  /** The app can receive fence events (always true on Flutter). */
  registered: boolean;
  /** The fence is already registered with the OS. */
  armed: boolean;
  /** "Allow all the time" is already granted, so arming shows no prompt. */
  alwaysGranted: boolean;
}

/** `'ask'` shows the OS prompt (once), `'silent'` arms with none, `'skip'` does nothing. */
export type ArmDecision = 'ask' | 'silent' | 'skip';

export function shouldArmBackground(i: ArmInputs): ArmDecision {
  if (i.optedOut || i.fresh || i.armed || !i.registered) return 'skip';
  // The workflow switched background monitoring off for this check.
  if (i.pin.background === false) return 'skip';
  // Unknown is never "running": without the server's word nobody is asked.
  if (!i.watch || i.watch.stopped) return 'skip';
  // A check in flight, or an always-on arrangement between two checks (only a
  // verified or inconclusive check is followed by another).
  const renews = i.watch.status === 'verified' || i.watch.status === 'inconclusive';
  const live = i.watch.status === 'in_progress' || (i.pin.alwaysOn === true && renews);
  if (!live) return 'skip';
  if (i.alwaysGranted) return 'silent';
  // One ask per stored address, whatever the answer was.
  return i.pin.backgroundAsked === true ? 'skip' : 'ask';
}

/** Arm the background tier when the rule says so. Never throws. */
export async function maybeArmBackground(
  options: { apiKey: string; externalUserId: string; devUrl?: string; autoBackground?: boolean },
  pin: StoredPin,
  watch: WatchState | null,
  fresh: boolean,
): Promise<EnableBackgroundResult | null> {
  try {
    const optedOut = options.autoBackground === false;
    // Decided before anything is read from the OS when the answer is already no.
    if (optedOut || fresh || pin.background === false) return null;
    const [armed, bg] = await Promise.all([
      geofenceArmed(),
      Location.getBackgroundPermissionsAsync().catch(() => null),
    ]);
    const decision = shouldArmBackground({
      optedOut,
      fresh,
      pin,
      watch,
      registered: backgroundPresenceRegistered(),
      armed,
      alwaysGranted: bg?.status === 'granted',
    });
    if (decision === 'skip') return null;
    // Marked BEFORE the prompt: an app closed while it is showing has asked.
    if (decision === 'ask') markBackgroundAsked(options.externalUserId);
    return await enableBackgroundPresence(options);
  } catch {
    return null;
  }
}
