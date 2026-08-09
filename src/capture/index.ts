// Auto-capture: the pure decision logic behind "shoot now".
//
// Barrel-only surface — screens import from here, never the internals, so the
// thresholds stay in one testable place.
export {
  DOCUMENT_SIGNALS,
  countSignalHits,
  detectDocumentType,
  hasDocumentSignals,
  hasMrzLines,
  type DocumentTypeMatch,
} from './documentSignals';
export {
  documentCarriesMrz,
  verifyDocumentIdentity,
  type DocumentFraming,
  type DocumentGuidance,
  type DocumentHint,
  type DocumentIdentityResult,
} from './documentIdentity';
export { DocumentTextGate, type TextBounds, type TextGateOptions } from './documentTextGate';
export { documentHintText, documentHintIsAction } from './hints';
export { useAutoCapture, type AutoCaptureState } from './useAutoCapture';
export { hasRectDetector, rectFramingProblem, type RectGateOptions } from './rectDetector';
