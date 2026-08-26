import { ID_TYPES } from '../config/idTypes';
import { poaMaxAgeDays } from '../config/proofOfAddress';
import { documentCaptureMeta } from '../screens/DocumentCaptureStep';
import { questionnaireMeta } from '../screens/QuestionnaireStep';
import { contactCodeLength, contactMeta, type ContactChallenge } from '../config/contact';

import { proofOfAddressMeta } from '../screens/ProofOfAddressStep';
import { countrySelectMeta } from '../screens/CountrySelectStep';
import { businessDetailsMeta } from '../screens/BusinessDetailsStep';
import { businessKeyPeopleMeta } from '../screens/BusinessKeyPeopleStep';
import { businessDocumentsMeta } from '../screens/BusinessDocumentsStep';
import { applicantRoleMeta } from '../screens/ApplicantRoleStep';
import { nfcMeta } from '../screens/NfcStep';
import type { DocumentCapturePhase } from '../store/state';
import type { KYCStep, ResolvedKYCConfig, SupportedCountry } from '../types/config';

// ---------------------------------------------------------------------------
// The sheet header's title and description, per step.
//
// Split from KycFlow.tsx (200-line rule). Each step owns its own copy — the
// screens export their `…Meta` — and this only chooses between them, so adding
// a step means adding its meta beside the screen, not editing a shell.
// ---------------------------------------------------------------------------

function labelFor(country: SupportedCountry, idType: string | null): string {
  if (!idType) return 'Document';
  return Object.values(ID_TYPES).flat().find((t) => t.key === idType)?.label ?? 'Document';
}

export interface StepHeaderContext {
  config: ResolvedKYCConfig;
  country: SupportedCountry;
  selectedIdType: string | null;
  documentCapturePhase: DocumentCapturePhase;
  /** Outstanding contact code — lets the header describe the OTP in flight. */
  contactChallenge: ContactChallenge | null;
}

export function stepHeaderMeta(
  currentStep: KYCStep,
  { config, country, selectedIdType, documentCapturePhase, contactChallenge }: StepHeaderContext,
): { title: string; description: string | null } {
  const label = labelFor(country, selectedIdType);
    switch (currentStep) {
      case 'consent':
        return { title: '', description: null as string | null };
      case 'id-type':
        return { title: 'Select ID Type', description: "Choose the type of identification document you'd like to use." };
      case 'id-input':
        // The number is all this step asks for. The name comes from the
        // integrator (mount props / the session), never the applicant.
        return { title: `Enter your ${label}`, description: 'We’ll check this against the official record.' };
      case 'document-capture':
        // Phase-aware title/description live in the header (synced from the
        // capture screen via `documentCapturePhase`) — mirrors Flutter.
        return documentCaptureMeta(documentCapturePhase, label);
      case 'liveness':
        return { title: 'Face Verification', description: 'Follow the on-screen instructions' };
      case 'questionnaire':
        return questionnaireMeta(config.questionnaire?.title, config.questionnaire?.description);
      case 'email-verification':
        return contactMeta('email', {
          codeLength: contactCodeLength(config.emailVerification),
          challenge: contactChallenge,
        });
      case 'phone-verification':
        return contactMeta('phone', {
          codeLength: contactCodeLength(config.phoneVerification),
          challenge: contactChallenge,
        });
      case 'proof-of-address':
        return proofOfAddressMeta(poaMaxAgeDays(config.proofOfAddress));
      case 'country-select':
        return countrySelectMeta;
      case 'business-details':
        return businessDetailsMeta;
      case 'business-key-people':
        return businessKeyPeopleMeta;
      case 'business-documents':
        return businessDocumentsMeta;
      case 'applicant-role':
        return applicantRoleMeta;
      case 'nfc':
        return nfcMeta;
      case 'submitted':
      default:
        return { title: '', description: null };
    }
}
