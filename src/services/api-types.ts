// ---------------------------------------------------------------------------
// The HTTP contract: every request and response shape the SDK exchanges with
// the server.
//
// Split from api.ts (200-line rule) so the client and the contract can be read
// separately — and so a module that only needs a type does not pull in the
// fetch/blob machinery. The server is the source of truth for all of it; these
// are declarations, never validation.
// ---------------------------------------------------------------------------

// The /verify request is large enough to live on its own; re-exported so this
// module remains the single view of the contract.
export type * from './api-verify-types';

/** Media kinds the SDK can upload — document/selfie photos plus best-effort videos. */
export type MediaUploadType =
  | 'document_front'
  | 'document_back'
  | 'selfie'
  | 'document_front_video'
  | 'document_back_video'
  | 'liveness_video'
  // The two kinds that accept a PDF — a proof of address is usually a
  // downloaded statement, and company paperwork is almost always a scan.
  | 'proof_of_address'
  | 'business_document';

/**
 * A file to upload, in React Native's multipart shape. `uri` points at a
 * local file (camera capture / gallery pick); `name`/`type` populate the
 * multipart part's filename + Content-Type.
 */
export interface UploadFile {
  uri: string;
  name?: string;
  /** Raw mime type (codec params are stripped before sending). */
  type?: string;
}

export interface UploadResponse {
  mediaId: string;
}

export interface KeyPersonInvite {
  keyPersonId: string;
  name: string;
  inviteUrl: string;
}

/**
 * The one status vocabulary, shared by `GET /api/kyc/status/:id`, the
 * secret-key result route and every verification webhook.
 *
 * `status` is what happened; `checkStatus` beside it is what the CHECKS found.
 * They differ when a person overrode the automated result, which is the case
 * worth being able to see: `approved` with `checkStatus: 'failed'` means
 * somebody accepted the applicant despite a failed check, and the reason says
 * what they accepted them despite.
 */
export type SessionStatus =
  | 'not_started'
    | 'in_progress'
    | 'processing'
    | 'in_review'
    | 'awaiting_resubmission'
    | 'approved'
    | 'declined'
    | 'abandoned'
    | 'expired'
    | 'error';

export interface VerifyResponse {
  verificationId: string;
  /** Always `processing`: accepted, checks running. */
  status: 'processing';
  /**
   * KYB with applicant verification: the KeyPerson row the applicant's OWN
   * identity check must link back to, via `metadata.userId` on a second,
   * ordinary individual submission.
   */
  applicantKeyPersonId?: string;
  /** Per-person hosted-KYC links to hand to the people the applicant listed. */
  keyPeopleInvites?: KeyPersonInvite[];
}

/**
 * Minimal, publishable-safe status from `GET /api/kyc/status/:id` — no PII,
 * scores, or result data; only the lifecycle state and an org-safe reason.
 */
export interface VerificationStatusResponse {
  verificationId: string;
  status: SessionStatus;
  /** What the CHECKS found, unchanged by any later decision. */
  checkStatus?: 'pending' | 'verified' | 'failed' | 'not_found' | 'error';
  reason?: string | null;
  reasonCode?: string | null;
  createdAt: string;
  completedAt?: string;
}

export interface SdkConfigIdType {
  country: string;
  idType: string;
  /**
   * Whether this document carries a readable eMRTD chip. Catalogue-driven
   * server-side and intrinsic to the ID (not org-gated), so it is the
   * authoritative answer to "should the chip step be offered".
   */
  supportsNfc?: boolean;
  /**
   * Display metadata the server sends per pair. Load-bearing for Global
   * Documents: the SDK's curated table only covers the five gov-DB countries,
   * so for any of the other ~235 these fields ARE the definition. Dropping
   * them (as this type used to) left those countries with an empty ID list.
   */
  label?: string;
  requiresDocumentCapture?: boolean;
  scanSides?: string;
  features: {
    documentVerification: boolean;
    livenessCheck: boolean;
    govDbCheck: boolean;
  };
}

/** Org branding configured server-side, returned with the SDK config. */
export interface SdkConfigBranding {
  logo?: string;
  companyName?: string;
  primaryColor?: string;
}

export interface SdkConfigResponse {
  environment: 'DEVELOPMENT' | 'SANDBOX' | 'PRODUCTION';
  idTypes: SdkConfigIdType[];
  branding?: SdkConfigBranding;
  /**
   * The visitor's country, resolved from their IP.
   *
   * A GUESS and only ever a DEFAULT — nothing branches on it and it never
   * reaches a verification. Deliberately not evidence: device intelligence
   * carries the same lookup as a RISK signal, and the two must not be confused.
   */
  geoCountry?: string | null;
}

/**
 * The template half of a resolved workflow — exactly the keys a published flow
 * may set. Loosely typed on purpose: the server is the contract, and an unknown
 * key added there must not make an older SDK fail to parse. `mergeWorkflowConfig`
 * only reads the keys it knows.
 */
export type WorkflowConfigPayload = Record<string, unknown>;

/**
 * A KYB workflow's mapped APPLICANT workflow (business.applicant.workflowId),
 * resolved server-side: the individual workflow whose capture template
 * overlays the applicant's own KYC leg, and whose id is stamped on that
 * submission.
 */
export interface ApplicantWorkflowPayload {
  id: string;
  name: string;
  version: number;
  config: WorkflowConfigPayload;
}

/** Response from `GET /api/kyc/workflows/:workflowId` — one round trip hydrates
 *  the SDK, so `/config` is skipped entirely. */
export interface WorkflowResolutionResponse {
  workflow: { id: string; name: string; version: number };
  config: WorkflowConfigPayload;
  environment: 'DEVELOPMENT' | 'SANDBOX' | 'PRODUCTION';
  /** Org allowlist + per-ID feature flags (same shape as /config). */
  idTypes: SdkConfigIdType[];
  branding?: SdkConfigBranding;
  /**
   * The visitor's country, resolved from their IP.
   *
   * A GUESS and only ever a DEFAULT — nothing branches on it and it never
   * reaches a verification. Deliberately not evidence: device intelligence
   * carries the same lookup as a RISK signal, and the two must not be confused.
   */
  geoCountry?: string | null;
  /** KYB only: the mapped applicant workflow, when configured and resolvable. */
  applicantWorkflow?: ApplicantWorkflowPayload | null;
}

export interface ContactSendResponse {
  challengeId: string;
  expiresAt: string;
  deliveryChannel: string;
}

export interface ContactCheckResponse {
  verified: boolean;
  /** Single-use proof submitted with /verify as `contact.emailToken`/`phoneToken`. */
  token: string;
}

/**
 * A server-issued Active-Authentication challenge. `challenge` is base64 of the
 * 8 bytes handed to the chip; `challengeId` is what rides the submission so the
 * server can spend it (single-use — a replayed one is refused).
 */
export interface NfcChallengeResponse {
  challengeId: string;
  challenge: string;
  expiresAt: string;
}

export interface HealthResponse {
  status: string;
}

// The mime types the server accepts (must mirror the server's upload allowlist).

/** `POST /session/start` — mint (or resume) an attempt session. */
export interface SessionStartResponse {
  sessionId: string;
  expiresAt: string;
  resumed: boolean;
  /** The session's own hosted web page. After a KYB submission it is the
   *  rehydrated success screen with every key person's invite link — the
   *  applicant's way back to those links once the app closes. */
  url?: string;
  /** Where the user got to, when resuming. Media references are already
   *  pruned server-side of anything that has since expired. */
  progress?: {
    step?: string;
    mediaIds?: Record<string, string>;
    data?: Record<string, unknown>;
  };
}

/** One person a submitted KYB application is still waiting on (the server's
 *  reconciled view — registry discovery can add people the applicant never
 *  listed, so this list supersedes the submit-time invites). */
export interface AwaitingPersonPayload {
  id: string;
  name: string;
  role: string;
  ownershipPct: number | null;
  /** ISO-2, or null when the register gave free text no flag matches. */
  country: string | null;
  status: 'verified' | 'failed' | 'submitted' | 'pending' | 'not_needed';
  /** Null once their check is done, or when they never needed one. */
  inviteUrl: string | null;
  isApplicant: boolean;
  /** A company completes a KYB application, not a KYC - the list labels it so. */
  isCorporate?: boolean;
}

/** `GET /session/:sessionId/summary` — a submitted session, rebuilt server-side. */
export interface SessionSummaryResponse {
  status: 'completed';
  /** False while registry discovery is still reconciling the people list. */
  keyPeopleSettled?: boolean;
  keyPeople: AwaitingPersonPayload[];
}

/** One officer as the register names them — the key-people prefill's input. */
export interface RegistryOfficer {
  name: string | null;
  designation: string | null;
  /** Everything else the register said about them (older servers omit these). */
  roles?: string[] | null;
  ownershipPct?: number | null;
  email?: string | null;
  isCorporate?: boolean | null;
  registrationNumber?: string | null;
}

/** What the register holds about a company, when it answered. Everything is
 *  nullable because no register answers all of it for every company. */
export interface BusinessCompanyRecord {
  name: string | null;
  registrationNumber: string;
  registrationDate: string | null;
  typeOfEntity: string | null;
  companyStatus: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  vatNumber: string | null;
  natureOfBusiness: string | null;
  city: string | null;
  state: string | null;
}

/** `POST /business/select` — the paid registry check at selection. */
export interface BusinessSelectResponse {
  checked: boolean;
  /** Why the pre-flight did not run (`checked: false`) — the submit-time lookup
   *  still happens, so this is informational, never an error. */
  reason?: string;
  found?: boolean;
  charged?: boolean;
  business?: (BusinessCompanyRecord & { keyPeople: RegistryOfficer[] }) | null;
}

/** One candidate from the FREE name search — picking one is what runs the paid check. */
export interface BusinessSearchHit {
  name: string;
  registrationNumber: string;
  status?: string;
}

/** `GET /business/search` — find a business by name. */
export interface BusinessSearchResponse {
  results: BusinessSearchHit[];
  /** Which source answered; a degraded fallback names itself here. */
  source: string;
}

/** `GET /business/regions` — the registry regions of a split register. */
export interface BusinessRegionsResponse {
  regions: { code: string; name: string }[];
}
