import type { FlashHole } from '../components/flashHoleGeometry';
// ---------------------------------------------------------------------------
// The flow's state shapes.
//
// Split from kycStore.ts (200-line rule). These are pure type declarations plus
// their empty values — no store, no actions — so any module can describe the
// state without importing the store and its whole dependency graph.
// ---------------------------------------------------------------------------

import type { StoreApi } from 'zustand/vanilla';

import type { KYCApi, KeyPersonInvite } from '../services/api';
import type { IdType, KYCStep, ResolvedKYCConfig } from '../types/config';
import type { PoaDocumentType } from '../types/workflow';
import type { ApplicantRole } from '../types/business';
import type { QuestionnaireAnswers } from '../config/questionnaire';
import type { ContactChallenge } from '../config/contact';
import type { QuestionnaireAnswerValue } from '../types/workflow';
import type { KeyPersonEntry } from '../config/keyPeople';
import type { ServerConfigState } from './serverConfig';
import type { CaptureIntegrity } from '../liveness/integritySignals';
import type { MrzScan } from '../mrz/parse';
import type { EmrtdReadResult } from '../emrtd';

export interface KYCMediaIds {
  /** Proof-of-address document (image or PDF). */
  proofOfAddress?: string;
  documentFront?: string;
  documentBack?: string;
  selfie?: string;
  documentFrontVideo?: string;
  documentBackVideo?: string;
  livenessVideo?: string;
}

export interface KYCSubmissionResult {
  verificationId: string;
  status: 'pending';
}

export type DocumentScanPhase = 'front' | 'back' | 'complete';

/** What the business-details step (and the KYB application steps) collect. */
export interface BusinessState {
  /** Picked registry country — null until chosen on a multi-registry flow. */
  country: string | null;
  /** Picked product key — null until chosen / defaulted. */
  product: string | null;
  registrationNumber: string;
  registrationName: string;
  /** Where key-people invite links are emailed. */
  contactEmail: string;
  address: string;
  email: string;
  phone: string;
  website: string;
}

/** One uploaded supporting document. */
export interface BusinessDocumentUpload {
  type: string;
  mediaId: string;
  fileName: string;
  /**
   * Local URI of the picked image, for the slot thumbnail. Kept on the RECORD
   * (not screen state) so the preview survives leaving and re-entering the
   * step. Never submitted.
   */
  previewUri?: string;
  isPdf?: boolean;
}

/** The KYB application beyond the registry details. */
export interface BusinessApplicationState {
  keyPeople: KeyPersonEntry[];
  documents: BusinessDocumentUpload[];
  applicantRole: ApplicantRole | null;
  applicantName: string;
  /**
   * The applicant picked THEMSELVES from the entered key people (index into
   * `keyPeople`). Null = they're someone else / nothing picked. The flagged
   * entry is merged server-side with the applicant row — one person, one KYC,
   * one screening, no duplicate invite.
   */
  applicantKeyPersonIndex: number | null;
}

export const EMPTY_BUSINESS_APPLICATION: BusinessApplicationState = {
  keyPeople: [],
  documents: [],
  applicantRole: null,
  applicantName: '',
  applicantKeyPersonIndex: null,
};

export const EMPTY_BUSINESS: BusinessState = {
  country: null,
  product: null,
  registrationNumber: '',
  registrationName: '',
  contactEmail: '',
  address: '',
  email: '',
  phone: '',
  website: '',
};

export interface ContactState {
  emailAddress?: string;
  phoneNumber?: string;
  /** Single-use proof from a passed email check. */
  emailToken?: string;
  /** Single-use proof from a passed phone check. */
  phoneToken?: string;
}

/** Document-capture sub-phase — drives the sheet header title/description. */
export type DocumentCapturePhase = 'front' | 'front-preview' | 'back' | 'review';

/** The mediaIds keys settable via `setMediaId`. */
export type MediaIdKey = keyof KYCMediaIds;

export interface KycState {
  config: ResolvedKYCConfig;
  api: KYCApi;

  currentStep: KYCStep;
  /**
   * The country picked on the multi-region country-select step. Null on a
   * single-country flow, where `config.country` is the answer.
   */
  selectedCountry: string | null;
  selectedIdType: IdType | null;
  idNumber: string | null;
  mediaIds: KYCMediaIds;
  submissionResult: KYCSubmissionResult | null;
  serverConfig: ServerConfigState;
  documentScanPhase: DocumentScanPhase;
  /** Sub-phase of the document-capture step — synced by the screen so the header
   *  title/description can be phase-aware (mirrors Flutter's docReviewPhase). */
  documentCapturePhase: DocumentCapturePhase;
  /**
   * True while a full-bleed camera owns the screen.
   *
   * The sheet's header, padding and scroll view are what force a small
   * viewfinder on a short phone — and a camera you have to SCROLL to is a
   * broken camera. When this is set the shell steps out of the way entirely.
   */
  immersiveCapture: boolean;
  /**
   * What the flash overlay should paint, hoisted OUT of the liveness step.
   *
   * It has to be drawn at the sheet root, not inside the step: the step sits in
   * a padded, scrolling body, so an overlay there lights only a fraction of the
   * display — and the screen IS the light source for this check.
   *
   * It cannot be drawn in a modal of its own either. iOS scales a presenting
   * sheet back when a modal appears over it, and RN's `measureInWindow` reports
   * Yoga LAYOUT coordinates, which never reflect that UIKit transform. The
   * cutout would be measured at full size while the preview renders at ~0.77 of
   * it — off by the transform, with no reading that can ever converge. Painting
   * in the same tree means the hole and the preview scale together, so the two
   * agree by construction rather than by measurement.
   */
  flashPaint: { color: string | null; hole: FlashHole | null } | null;
  /**
   * Which way the user last moved through the flow.
   *
   * A step that SKIPS ITSELF (no NFC radio, a disabled feature) must skip the
   * way the user was already going. Always advancing forward makes such a step
   * a one-way valve: pressing Back onto it bounces you straight forward again,
   * so the steps before it become unreachable.
   */
  navDirection: 'forward' | 'back';
  /** Answers to the workflow's compliance questionnaire, keyed by field key. */
  questionnaireAnswers: QuestionnaireAnswers;
  /** Business (KYB) registry details. Unused on an individual flow. */
  business: BusinessState;
  /** The rest of the KYB application: people, documents, applicant role. */
  businessApplication: BusinessApplicationState;
  /**
   * Set by a KYB submission that requires applicant verification — the
   * KeyPerson id the applicant's own individual check links back to.
   */
  applicantKeyPersonId: string | null;
  /** Per-person hosted-KYC links returned by a KYB submission. */
  keyPeopleInvites: KeyPersonInvite[];
  /**
   * What the client observed while capturing — the flash claim in particular.
   * Sent as CONTEXT, never as a verdict: the server re-analyses the recorded
   * video against the sequence claimed here.
   */
  captureIntegrity: CaptureIntegrity | null;
  /**
   * The MRZ read off the document photo. It is the KEY that unlocks the chip —
   * possession of the document is the access control — and it is also what the
   * server checks the chip's own DG1 against.
   */
  mrzScan: MrzScan | null;
  /** What the chip returned. Absent when it was skipped or unreadable. */
  chipData: EmrtdReadResult | null;
  /** Which kind of document was uploaded as proof of address. */
  poaDocumentType: PoaDocumentType | null;
  /** Its file name, so the uploaded state can name what it has. */
  poaFileName: string | null;
  /**
   * Contact-verification results. The proofs are single-use and ride the
   * /verify submission; the addresses are kept so returning to the step (or a
   * retry) shows what the user already typed rather than a blank field.
   */
  contact: ContactState;
  /** Outstanding contact code, for the header. Null while entering a destination. */
  contactChallenge: ContactChallenge | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadServerConfig: () => Promise<void>;
  setCountry: (country: string) => void;
  setIdType: (idType: IdType) => void;
  setIdNumber: (idNumber: string) => void;
  setMediaId: (key: MediaIdKey, mediaId: string) => void;
  setDocumentMediaId: (mediaId: string, side: 'front' | 'back') => void;
  setQuestionnaireAnswer: (key: string, value: QuestionnaireAnswerValue | undefined) => void;
  setContactVerified: (channel: 'email' | 'phone', destination: string, token: string) => void;
  setContactDestination: (channel: 'email' | 'phone', destination: string) => void;
  setBusinessField: <K extends keyof BusinessState>(key: K, value: BusinessState[K]) => void;
  setKeyPeople: (rows: KeyPersonEntry[]) => void;
  setBusinessDocument: (doc: BusinessDocumentUpload) => void;
  removeBusinessDocument: (type: string) => void;
  setApplicant: (role: ApplicantRole, name: string, keyPersonIndex?: number | null) => void;
  setCaptureIntegrity: (integrity: CaptureIntegrity) => void;
  setMrzScan: (scan: MrzScan) => void;
  setChipData: (data: EmrtdReadResult) => void;
  setProofOfAddress: (mediaId: string, docType: PoaDocumentType, fileName: string) => void;
  clearProofOfAddress: () => void;
  setDocumentCapturePhase: (phase: DocumentCapturePhase) => void;
  setContactChallenge: (challenge: ContactChallenge | null) => void;
  setImmersiveCapture: (immersive: boolean) => void;
  setFlashPaint: (paint: { color: string | null; hole: FlashHole | null } | null) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: KYCStep) => void;
  submitAsync: (onRetry?: (attempt: number, total: number) => void) => Promise<KYCSubmissionResult>;
  reset: () => void;
}


// ---------------------------------------------------------------------------
// Flow navigation — single source of truth for the 5-step sequence.
// ---------------------------------------------------------------------------

export type KycStore = StoreApi<KycState>;
