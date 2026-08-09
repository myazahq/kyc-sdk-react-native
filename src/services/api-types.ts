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

export interface VerifyResponse {
  verificationId: string;
  status: 'pending';
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
  status: 'pending' | 'verified' | 'failed' | 'not_found' | 'error';
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

export interface HealthResponse {
  status: string;
}

// The mime types the server accepts (must mirror the server's upload allowlist).
