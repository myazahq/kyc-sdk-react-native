import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { KYCApi } from '../services/api';
import type { AwaitingPersonPayload } from '../services/api-types';

// The SERVER's list of who a submitted KYB application is waiting on — mirrors
// the web SDK's use-awaiting-people 1:1.
//
// MEMBERSHIP settles once: registry discovery runs after submission and can
// add people the applicant never listed, so nothing renders until the server
// says it has finished (`keyPeopleSettled`). A list shown earlier is one
// director short and would be contradicted moments later.
//
// STATUS stays live: the people named go and verify after this screen is first
// shown, so once settled the list re-reads slowly while anybody still owes a
// check — and re-reads on foreground, which is exactly when a stale badge
// would be noticed.

/** How often to re-ask while the server says it is still reconciling. */
const RETRY_MS = 1500;
/** How long to wait before showing whatever there is (discovery's final write
 *  is best-effort; a spinner forever is worse than a list that might be short). */
const GIVE_UP_MS = 15_000;
/** Status-refresh cadence once settled, while anybody owes a check. */
const POLL_MS = 20_000;

function anyoneStillOwes(people: AwaitingPersonPayload[]): boolean {
  return people.some(
    (p) => p.status === 'pending' || p.status === 'submitted' || p.status === 'failed',
  );
}

export function useAwaitingPeople(
  api: KYCApi,
  sessionId: string | null,
  enabled: boolean,
): AwaitingPersonPayload[] | null {
  const [people, setPeople] = useState<AwaitingPersonPayload[] | null>(null);

  useEffect(() => {
    if (!sessionId || !enabled) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let committed = false;
    const startedAt = Date.now();

    const read = async (): Promise<void> => {
      if (cancelled) return;
      const summary = await api.sessionSummary(sessionId).catch(() => null);
      if (cancelled) return;
      const expired = Date.now() - startedAt > GIVE_UP_MS;

      if (summary && (summary.keyPeopleSettled !== false || expired)) {
        committed = true;
        setPeople(summary.keyPeople);
        if (anyoneStillOwes(summary.keyPeople)) {
          timer = setTimeout(() => void read(), POLL_MS);
        }
        return;
      }
      if (committed) {
        // One failed refresh must not end the updates: the list on screen is
        // still true, only a little older.
        timer = setTimeout(() => void read(), POLL_MS);
        return;
      }
      if (expired) {
        // Nothing readable at all — leave the list absent rather than empty,
        // which would claim there is nobody to verify.
        return;
      }
      timer = setTimeout(() => void read(), RETRY_MS);
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (timer) clearTimeout(timer);
      void read();
    });

    void read();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [api, sessionId, enabled]);

  return people;
}
