import { isAddressStep } from './address-flow';
import type { KYCStep } from '../types/config';

// ---------------------------------------------------------------------------
// Recovering an attempt resumed onto an address step the flow no longer has.
//
// The address flow is the only part of the SDK whose SHAPE depends on something
// other than the workflow the applicant is walking: `searchAvailable` comes from
// a server flag that arrives after the session restore has already written the
// step it was saved on. Add a republish that drops the entrance photo, and a
// resumed applicant can be sitting on a screen the current order does not
// contain — where Continue has nothing to advance to and Back has no
// predecessor, so the flow is simply stuck.
//
// The rule is FORWARD: a step the flow no longer has is a capture it is no
// longer asking for, so the applicant carries on rather than being sent back to
// redo work they had already finished.
// ---------------------------------------------------------------------------

/** The address flow's four screens, in the order they are always walked. */
const CANONICAL: readonly KYCStep[] = [
  'address-search',
  'address-collection',
  'address-entrance',
  'address-review',
];

/**
 * The step that follows the address region in an order that CONTAINS it — where
 * an applicant belongs when the workflow has dropped address collection
 * altogether. Computed from the real order rather than guessed, so it is the
 * step they would have reached had they finished.
 */
export function addressExitStep(orderWithAddress: readonly KYCStep[]): KYCStep | null {
  for (let i = orderWithAddress.length - 1; i >= 0; i -= 1) {
    if (isAddressStep(orderWithAddress[i]!)) return orderWithAddress[i + 1] ?? null;
  }
  return null;
}

/**
 * Where to send an applicant sitting on an address step this flow does not
 * contain, or null when there is nothing wrong.
 *
 * `inFlow` is the address steps the CURRENT order has, in order; `exit` is where
 * to go when it has none left (see `addressExitStep`).
 */
export function recoverAddressStep(
  current: KYCStep,
  inFlow: readonly KYCStep[],
  exit: KYCStep | null,
): KYCStep | null {
  if (!isAddressStep(current) || inFlow.includes(current)) return null;
  const from = CANONICAL.indexOf(current);
  for (let i = from + 1; i < CANONICAL.length; i += 1) {
    const step = CANONICAL[i]!;
    if (inFlow.includes(step)) return step;
  }
  // Nothing after it either: the last screen the flow does have (KYB resumed
  // onto a review it never renders belongs on its premises pin), else out of
  // the address flow entirely.
  return inFlow[inFlow.length - 1] ?? exit;
}
