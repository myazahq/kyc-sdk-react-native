import { myazaProviderName, needsMyazaDisclosure } from '../../lib/trust-attribution';

// ---------------------------------------------------------------------------
// The consent notice above Continue, as one paragraph of text and link parts.
// Mirrors the web SDK's ConsentLegalNotice.
//
// When the org's own logo replaces Myaza's in the footer, the paragraph opens
// by naming Myaza Trust as the provider for that organisation and calls the
// terms Myaza Trust's: Myaza still processes the applicant's data (and
// biometrics), so data protection law needs it disclosed. With the Myaza
// footer the notice is exactly what it always was. None of this wording is
// customisable. Pure, so the choice is unit-tested.
// ---------------------------------------------------------------------------

/** The two link labels (legal wording, never customisable). */
export const TERMS_LABEL = 'End User Terms';
export const PRIVACY_LABEL = 'Privacy Policy';

export type LegalPart = { kind: 'text'; text: string } | { kind: 'terms' } | { kind: 'privacy' };

const SENTENCE = {
  myaza: 'By tapping Continue, you agree to the {terms} and {privacy}, and consent to your {data} being processed to verify your identity.',
  custom:
    'By tapping Continue, you agree to Myaza Trust’s {terms} and {privacy}, and consent to your {data} being processed to verify your identity.',
};

export interface LegalNoticeInput {
  isBusiness: boolean;
  capturesFace: boolean;
  recordsVideo: boolean;
  /** `branding.trustAttribution` as the server sent it. */
  attribution: unknown;
  /** The workflow's `appearance.companyName`. */
  workflowCompanyName?: string;
  /** `branding.companyName`. */
  brandingCompanyName?: string;
}

export function consentLegalNotice(input: LegalNoticeInput): LegalPart[] {
  const namesMyaza = needsMyazaDisclosure(input.attribution);
  const org = namesMyaza
    ? myazaProviderName(input.attribution, input.workflowCompanyName, input.brandingCompanyName)
    : '';
  const lead = !namesMyaza
    ? ''
    : org
      ? `Verification is processed by Myaza Trust for ${org}. `
      : 'Verification is processed by Myaza Trust. ';
  const data = input.isBusiness ? 'business and personal data' : 'personal data';
  const extra = input.capturesFace
    ? ' This includes facial recognition and recording this session.'
    : input.recordsVideo
      ? ' This includes recording this session.'
      : '';
  const sentence = lead + SENTENCE[namesMyaza ? 'custom' : 'myaza'].replace('{data}', data) + extra;
  return sentence
    .split(/(\{terms\}|\{privacy\})/)
    .filter((part) => part !== '')
    .map((part): LegalPart =>
      part === '{terms}' ? { kind: 'terms' } : part === '{privacy}' ? { kind: 'privacy' } : { kind: 'text', text: part },
    );
}

/** The paragraph as plain text, with the link labels in place (tests, a11y). */
export function legalNoticeText(parts: LegalPart[]): string {
  return parts
    .map((p) => (p.kind === 'terms' ? TERMS_LABEL : p.kind === 'privacy' ? PRIVACY_LABEL : p.text))
    .join('');
}
