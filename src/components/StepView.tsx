import React, { useEffect } from 'react';
import { View } from 'react-native';

import { useKycStore } from './runtime';
import type { KYCStep } from '../types/config';
import { ConsentStep } from '../screens/ConsentStep';
import { IdTypeStep } from '../screens/IdTypeStep';
import { IdInputStep } from '../screens/IdInputStep';
import { DocumentCaptureStep } from '../screens/DocumentCaptureStep';
import { LivenessStep } from '../screens/LivenessStep';
import { SubmittedStep } from '../screens/SubmittedStep';
import { QuestionnaireStep } from '../screens/QuestionnaireStep';
import { ContactVerificationStep } from '../screens/ContactVerificationStep';
import { ProofOfAddressStep } from '../screens/ProofOfAddressStep';
import { CountrySelectStep } from '../screens/CountrySelectStep';
import { BusinessDetailsStep } from '../screens/BusinessDetailsStep';
import { BusinessKeyPeopleStep } from '../screens/BusinessKeyPeopleStep';
import { BusinessDocumentsStep } from '../screens/BusinessDocumentsStep';
import { ApplicantRoleStep } from '../screens/ApplicantRoleStep';
import { NfcStep } from '../screens/NfcStep';

// ---------------------------------------------------------------------------
// The step router — which screen a step renders.
//
// Split from KycFlow.tsx (200-line rule) so adding a step touches the router
// and the step order, and nothing else.
// ---------------------------------------------------------------------------

export function StepView({ step, onClose }: { step: KYCStep; onClose: () => void }): React.ReactElement {
  switch (step) {
    case 'consent':
      return <ConsentStep />;
    case 'id-type':
      return <IdTypeStep />;
    case 'id-input':
      return <IdInputStep />;
    case 'document-capture':
      return <DocumentCaptureStep />;
    case 'liveness':
      return <LivenessStep />;
    case 'questionnaire':
      return <QuestionnaireStep />;
    // Distinct keys are LOAD-BEARING: both mounts are the same component type
    // at the same position, so without them React reuses the instance when the
    // flow moves email → phone. The phone step would open holding the email
    // step's challengeId, show its code panel, and verifying would file the
    // EMAIL proof as the phone token — which the server then drops, blocking
    // submission on a phone check the user appears to have passed.
    case 'email-verification':
      return <ContactVerificationStep key="contact-email" channel="email" />;
    case 'phone-verification':
      return <ContactVerificationStep key="contact-phone" channel="phone" />;
    case 'proof-of-address':
      return <ProofOfAddressStep />;
    case 'country-select':
      return <CountrySelectStep />;
    case 'business-details':
      return <BusinessDetailsStep />;
    case 'business-key-people':
      return <BusinessKeyPeopleStep />;
    case 'business-documents':
      return <BusinessDocumentsStep />;
    case 'applicant-role':
      return <ApplicantRoleStep />;
    case 'nfc':
      return <NfcStep />;
    case 'submitted':
      return <SubmittedStep onClose={onClose} />;
    default:
      return <UnimplementedStep step={step} />;
  }
}

/**
 * A step that is in the order but has no screen on this platform yet.
 *
 * It advances rather than rendering something — the previous `default` fell
 * back to the consent screen, which put the user in a loop they could not leave
 * (consent's Continue leads back to the same step). Skipping degrades an
 * unbuilt step to "it didn't run", which is the same thing a workflow that left
 * it off would do, and is recoverable. Logged so it surfaces in development
 * instead of only as a step that mysteriously never appears.
 */
function UnimplementedStep({ step }: { step: KYCStep }): React.ReactElement {
  const store = useKycStore();
  useEffect(() => {
    console.warn(`[myaza-kyc] No screen for step "${step}" — skipping.`);
    store.getState().nextStep();
  }, [step, store]);
  return <View />;
}
