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

// Public config + callback types
export type {
  MyazaKYCConfig,
  SupportedCountry,
  IdType,
  IdTypeForCountry,
  IdTypeDefinition,
  KYCStep,
  KYCAppearance,
  KYCConsentContent,
  KYCSuccessContent,
  VoiceGuidanceConfig,
  VoiceGuidanceOption,
} from './types/config';
export type { KYCSubmission, KYCErrorCode, KYCErrorDetails } from './types/verification';
export { KYCError } from './types/verification';

// ID-type matrix + helpers
export {
  ID_TYPES,
  COUNTRY_LABELS,
  isNumberOnlyIdType,
  requiresDocumentCapture,
  getScanSides,
} from './config/idTypes';

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

// SDK version
export { SDK_VERSION } from './services/deviceMetadata';
