import { ID_TYPES } from '../config/idTypes';
import { poaDocumentTypes, poaMaxAgeDays, poaNamePolicy } from '../config/proofOfAddress';
import { documentCaptureMeta } from '../screens/DocumentCaptureStep';
import { questionnaireMeta } from '../screens/QuestionnaireStep';
import { contactCodeLength, contactMeta, type ContactChallenge } from '../config/contact';

import { proofOfAddressMeta } from '../screens/ProofOfAddressStep';
import { addressStepMeta } from '../screens/address';
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
  /**
   * The presence primer is on screen in place of the address step's body.
   *
   * It carries its own title, so the step's would sit above it saying something
   * else about a screen that is not showing. Blanking the header leaves just
   * the back arrow, the way the consent step does.
   */
  addressIntroPending?: boolean;
  /** The entrance step is framing street imagery rather than asking for a photo. */
  addressEntranceFraming?: boolean;
  /** The proof-of-address kind the applicant has picked, so the header can ask
   *  for what the workflow's name rule wants on THAT document. */
  poaDocumentType?: string | null;
}

export function stepHeaderMeta(
  currentStep: KYCStep,
  {
    config,
    country,
    selectedIdType,
    documentCapturePhase,
    contactChallenge,
    addressIntroPending,
    addressEntranceFraming,
    poaDocumentType,
  }: StepHeaderContext,
): { title: string; description: string | null } {
  const label = labelFor(country, selectedIdType);
  if (addressIntroPending) return { title: '', description: null };
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
      case 'proof-of-address': {
        // Word the ask by the rule the server will judge THIS document under:
        // the picked kind, else the first the country offers (what the screen
        // preselects). Under `off` the header stops asking for the name.
        const poa = config.proofOfAddress;
        const kind = poaDocumentType ?? poaDocumentTypes(poa, country)[0];
        return proofOfAddressMeta(
          poaMaxAgeDays(poa),
          poaNamePolicy(poa, country, kind as Parameters<typeof poaNamePolicy>[2]) !== 'off',
        );
      }
      case 'address-search':
      case 'address-collection':
      case 'address-entrance':
      case 'address-review':
        return addressStepMeta(currentStep, config.subjectType === 'business', { framing: addressEntranceFraming });
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
