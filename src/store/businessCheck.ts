import type { BusinessCheckResult, KycState } from './state';
import { EMPTY_BUSINESS_CHECK } from './state';

// ---------------------------------------------------------------------------
// The paid registry check at SELECTION, split from kycStore.ts (200-line rule).
//
// Run when the applicant confirms their company, so the register answers
// BEFORE the details screen asks them to confirm what it said — and its key
// people arrive before that step asks for them. Only a definitive "not on the
// register" stops the flow: everything else (a short balance, an outage, a
// spent lookup budget) continues and is checked at submission, exactly as it
// was before this existed. Mirrors the web SDK's useBusinessCheck — keep the
// two in lockstep.
// ---------------------------------------------------------------------------

type Set = (partial: Partial<KycState> | ((s: KycState) => Partial<KycState>)) => void;

export async function runBusinessCheck(
  get: () => KycState,
  set: Set,
): Promise<BusinessCheckResult> {
  const s = get();
  const registrationNumber = s.business.registrationNumber?.trim();
  if (!registrationNumber) return { canContinue: true, company: null };

  // Already checked this exact company — do not pay to be told again.
  //
  // Only a SETTLED answer is reused. 'unavailable' is deliberately not one: an
  // outage said nothing about the company, so a repeat press retries the
  // register rather than replaying the outage. And a remembered answer keeps
  // its meaning — a stored not_found still blocks.
  const normalized = registrationNumber.toUpperCase();
  const settled =
    s.businessCheck.status !== 'idle' &&
    s.businessCheck.status !== 'checking' &&
    s.businessCheck.status !== 'unavailable';
  if (s.businessCheck.checkedNumber === normalized && settled) {
    return {
      canContinue: s.businessCheck.status !== 'not_found',
      company: s.businessCheck.company,
    };
  }

  // No session means no anchor for the charge, so there is nothing to run
  // against. The check happens at submission, exactly as it did before.
  if (!s.sessionId) return { canContinue: true, company: null };

  set((cur) => ({
    businessCheck: { ...cur.businessCheck, status: 'checking', checkedNumber: normalized },
  }));
  try {
    const res = await s.api.businessSelect({
      sessionId: s.sessionId,
      country: s.business.country || s.config.business?.country || '',
      ...(s.business.subdivisionCode.trim()
        ? { subdivisionCode: s.business.subdivisionCode.trim() }
        : {}),
      ...(s.business.registrationName.trim()
        ? { registrationName: s.business.registrationName.trim() }
        : {}),
      ...(s.business.product ? { product: s.business.product } : {}),
      registrationNumber,
    });

    if (!res.checked) {
      // The organisation could not be charged. Not the applicant's problem and
      // not something they can fix, so it is not shown as an error — the flow
      // continues and the check runs at submission. `lookup_limit_reached` is
      // the one they DID cause, by re-picking company after company, and the
      // one they can act on: check the number rather than keep trying.
      set((cur) => ({
        businessCheck: {
          ...cur.businessCheck,
          status: res.reason === 'lookup_limit_reached' ? 'limit_reached' : 'skipped',
        },
      }));
      return { canContinue: true, company: null };
    }

    if (!res.found) {
      // A definitive "not on the register" is worth stopping for: continuing
      // would spend the applicant's time on documents for a company that will
      // fail anyway.
      set((cur) => ({
        businessCheck: { ...cur.businessCheck, status: 'not_found', company: null, officers: [] },
      }));
      return { canContinue: false, company: null };
    }

    const { keyPeople, ...company } = res.business!;
    set((cur) => ({
      businessCheck: {
        ...cur.businessCheck,
        status: 'found',
        company,
        officers: keyPeople ?? [],
      },
    }));
    return { canContinue: true, company };
  } catch {
    // A register outage is NOT "this company does not exist" — telling the
    // applicant their business is unregistered on the strength of a 503 is the
    // one wrong answer here. Retryable, and it never blocks: the check still
    // happens at submission.
    set((cur) => ({ businessCheck: { ...cur.businessCheck, status: 'unavailable' } }));
    return { canContinue: true, company: null };
  }
}

/** Back to square one — called when WHICH company this is about changes. */
export function resetBusinessCheck(set: Set): void {
  set({ businessCheck: { ...EMPTY_BUSINESS_CHECK } });
}
