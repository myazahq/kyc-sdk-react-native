// ---------------------------------------------------------------------------
// @myazahq/kyc-sdk-react-native — public API barrel.
//
// Mirrors the Flutter SDK's `kyc_sdk_flutter.dart`. The UI entry points
// (`MyazaKYC`, `useMyazaKYC`) are added in Step 2; this currently exports the
// public types, the ID-type matrix, validators, the typed error, and the
// liveness face-detector registry (for custom/test detector overrides).
// ---------------------------------------------------------------------------

// UI entry points
export { MyazaKYC, useMyazaKYC } from './MyazaKYC';
export type { MyazaKYCProps, UseMyazaKYCReturn } from './MyazaKYC';

// Returning-user face re-authentication (the web SDK's MyazaBiometricAuth).
export { MyazaBiometricAuth } from './MyazaBiometricAuth';
export type { MyazaBiometricAuthProps } from './MyazaBiometricAuth';
export type {
  BiometricAuthRequest,
  BiometricAuthResponse,
  BiometricStatusResponse,
  BiometricLivenessClaim,
} from './services/api-types-biometric';

// Public config + callback types
export type {
  MyazaKYCConfig,
  ResolvedKYCConfig,
  SupportedCountry,
  IdType,
  IdTypeForCountry,
  IdTypeDefinition,
  KYCStep,
  KYCAppearance,
  KYCConsentContent,
  KYCSuccessContent,
  VoiceGuidanceConfig,
  ProgressStyle,
  VoiceGuidanceOption,
  // Workflow-driven blocks — normally authored in the dashboard builder and
  // delivered by `workflowId`, but settable as props too.
  EmailVerificationConfig,
  PhoneVerificationConfig,
  ProofOfAddressConfig,
  PoaDocumentType,
  AddressCollectionConfig,
  QuestionnaireConfig,
  QuestionnaireField,
  QuestionnaireFieldOption,
  QuestionnaireAnswerValue,
  OtpInputStyle,
  NfcConfig,
  LivenessMode,
  WorkflowCountry,
  WorkflowIdOption,
} from './types/config';
export type {
  SubjectType,
  ApplicantRole,
  KeyPersonRole,
  KeyPeopleLevel,
  BusinessDocumentKey,
  CompanyInfoField,
  CompanyInfoMode,
  WorkflowBusinessConfig,
  WorkflowKeyPeopleConfig,
  WorkflowBusinessDocumentsConfig,
  WorkflowBusinessDocumentTypeConfig,
  WorkflowBusinessApplicantConfig,
} from './types/business';
export type { KYCSubmission, KYCResult, KYCErrorCode, KYCErrorDetails } from './types/verification';
export type { BiometricFlowConfig, BiometricCopy, BiometricCopyText } from './config/biometricOptions';
export { KYCError } from './types/verification';

// ID-type matrix + helpers
export {
  ID_TYPES,
  COUNTRY_LABELS,
  isNumberOnlyIdType,
  requiresDocumentCapture,
  getScanSides,
  supportsNfcChip,
} from './config/idTypes';

// Flow shape — the single ordered list navigation, the back button and the
// progress indicator all read.
export {
  buildStepOrder,
  getStepProgress,
  nextStepInOrder,
  previousStepInOrder,
  type StepOrderOptions,
} from './config/stepOrder';

// Business (KYB) product catalogue + application gates
export {
  BUSINESS_PRODUCTS,
  DEFAULT_BUSINESS_PRODUCT,
  businessCountriesFor,
  businessProductsFor,
  businessProductsForCountry,
  companyInfoFieldModes,
  getBusinessProductDef,
  isBusinessFlow,
  type BusinessProductDef,
} from './config/business';
export {
  businessSectionSteps,
  hasApplicantVerification,
  hasBusinessDocumentsStep,
  hasKeyPeopleCollection,
  keyPeopleMinEntries,
  resolveBusinessDocumentTypes,
  type BusinessSectionStep,
  type ResolvedBusinessDocumentType,
} from './config/businessSteps';

// Optional-step gates — the same helpers the step order reads, exported so a
// consumer can reason about which steps a given config will run.
export { hasActiveQuestionnaire, questionnaireAnswerKeys } from './config/questionnaire';
export { hasEmailVerificationStep, hasPhoneVerificationStep } from './config/contact';
export { hasProofOfAddressStep, poaDocumentTypes, poaTypeLabel } from './config/proofOfAddress';
export { hasAddressCollectionStep } from './config/addressCollection';
// Presence verification (Address Intelligence Phase 2): the foreground
// reporter the HOST APP calls on app open, plus the on-device pin store.
export {
  reportAddressPresence,
  type ReportPresenceOptions,
  type ReportPresenceResult,
} from './presence/report';
// The background (OS geofence) tier — the always-on model. register* must run
// at app-root module scope; enable* asks for the background permission.
export {
  PRESENCE_GEOFENCE_TASK,
  disableBackgroundPresence,
  enableBackgroundPresence,
  registerBackgroundPresence,
  type EnableBackgroundResult,
} from './presence/background';
// The Android foreground-service tier (the OkHi reliability move): a
// persistent notification keeps the process alive on phones whose battery
// managers drop geofence transitions. Opt-in; the host words the notification.
export {
  PRESENCE_LOCATION_TASK,
  disableForegroundService,
  enableForegroundService,
  foregroundServiceRunning,
  type EnableForegroundServiceResult,
  type PresenceNotification,
} from './presence/foreground-service';
export {
  openLocationSettings,
  presenceStatus,
  type PresenceStatus,
  type PresenceTier,
} from './presence/status';
export { resolvePresenceTier, type PermissionState, type TierInputs } from './presence/tier';
// savePresencePin is the org-side handoff for STANDALONE address verification:
// when capture happened on a hosted web link (or the org's own backend already
// holds the address), the host app hands the SDK the pin so the foreground and
// background presence tiers can run — the pin otherwise only ever exists where
// OUR capture step stored it.
export { clearPresencePin, savePresencePin } from './presence/store';

// Country grouping for multi-region flows
export { groupCountriesByRegion, regionCountryName, type Region } from './config/regions';

// Client-side validation
export { validateIdNumber, maskIdNumber, type ValidationResult } from './services/validators';

// Liveness — types + the face-detector seam (custom/test detector override)
export type { LivenessChallenge, LivenessConfig, LivenessFaceData } from './liveness/types';
export {
  type FaceDetectorService,
  StubFaceDetectorService,
  registerFaceDetectorFactory,
  createFaceDetectorService,
  hasFaceDetectorFactory,
} from './liveness/faceDetector';

// Device Intelligence — the fingerprint the server scores. Exported so a
// consumer can see exactly what is collected.
export {
  collectFingerprint,
  type ClientFingerprint,
  type FingerprintComponents,
} from './services/fingerprint';

// MRZ reading (ICAO 9303) — exported so a consumer can parse a document's
// machine-readable zone with the same check-digit validation the SDK uses.
export { mrzCheckDigit, parseMrz, type MrzScan } from './mrz/parse';
// Capability probes, so a consumer can tell "this build cannot read text" from
// "this document has no MRZ" — the two look identical from the outside, and
// only the first is worth reporting as a build problem.
export { hasTextRecognizer } from './mrz/textRecognizer';
export { hasRectDetector } from './capture/rectDetector';
export { extractMrz, sanitizeMrzLine } from './mrz/extract';

// eMRTD chip reading. The SERVER decides authenticity — it hashes DG1 against
// the signed security object and verifies the document signer. Nothing here
// concludes that a chip is genuine.
export {
  isNfcAvailable,
  readPassportChip,
  EmrtdSessionError,
  type EmrtdReadResult,
} from './emrtd';

// Flash (screen-reflection) liveness — the palette and correlation are a
// contract with the server's own re-analysis of the recorded video.
export {
  FLASH_PALETTE,
  generateFlashSequence,
  type FlashColor,
  type FlashResult,
} from './liveness/flashDetector';

// SDK version
export { SDK_VERSION } from './services/deviceMetadata';
