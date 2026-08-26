import { isValidContactEmail } from './contact';
import { isValidWebsite } from './website';
import type { CompanyInfoField, CompanyInfoMode } from '../types/business';
import type { BusinessCheckState, BusinessState } from '../store/state';

// ---------------------------------------------------------------------------
// Per-phase validity for the business-details step (200-line rule split).
//
// Gated per phase: on the pick screen the detail fields do not exist yet, so
// holding Continue until they are filled would be waiting on inputs that are
// not on screen. Empty is fine (optional unless the workflow says otherwise);
// a malformed value is not. Mirrors the web SDK's isFormValid exactly.
// ---------------------------------------------------------------------------

export function businessDetailsValid(input: {
  phase: 'pick' | 'details';
  business: BusinessState;
  modes: Record<CompanyInfoField, CompanyInfoMode>;
  product: string | null | undefined;
  numberValid: boolean;
  nameRequired: boolean;
  showContactEmail: boolean;
}): boolean {
  const { business, modes } = input;
  const pickValid =
    !!input.product &&
    input.numberValid &&
    (!input.nameRequired || business.registrationName.trim() !== '');
  if (input.phase === 'pick') return pickValid;

  const showCompanyInfo = Object.values(modes).some((m) => m !== 'off');
  const contactEmailValid =
    business.contactEmail.trim() === '' || isValidContactEmail(business.contactEmail.trim());
  const businessEmailValid =
    business.email.trim() === '' || isValidContactEmail(business.email.trim());
  const companyInfoComplete = (Object.keys(modes) as CompanyInfoField[]).every(
    (f) => modes[f] !== 'required' || business[f].trim() !== '',
  );
  return (
    pickValid &&
    (!input.showContactEmail || contactEmailValid) &&
    (!showCompanyInfo ||
      (businessEmailValid && isValidWebsite(business.website) && companyInfoComplete))
  );
}

/** Whether the check panel has anything to say. Found/skipped/idle stay
 *  silent, and so does 'checking' — the loader lives INSIDE the Continue
 *  button, since that is the thing the person just pressed. */
export function checkPanelVisible(status: BusinessCheckState['status']): boolean {
  return status === 'not_found' || status === 'limit_reached' || status === 'unavailable';
}
