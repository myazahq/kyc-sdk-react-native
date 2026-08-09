// ---------------------------------------------------------------------------
// The /verify request.
//
// Split from api-types.ts (200-line rule) because it is the largest and most
// consequential shape in the contract: every optional block on it corresponds
// to a step the flow may or may not have run, and sending one the flow did not
// collect is a claim we cannot support.
// ---------------------------------------------------------------------------

export interface VerifyRequest {
  country: string;
  idType: string;
  idNumber?: string;
  /** The org's user reference → Entity.externalUserId at the seam (not matched). */
  userId?: string;
  userData?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  };
  mediaIds: {
    documentFront?: string;
    documentBack?: string;
    selfie?: string;
    documentFrontVideo?: string;
    documentBackVideo?: string;
    livenessVideo?: string;
    proofOfAddress?: string;
  };
  /** Which kind of document the user said they uploaded as proof of address. */
  proofOfAddressType?: string;
  /**
   * Business (KYB) registry details. Its presence is what makes this a business
   * submission — and the server REQUIRES a published KYB workflow for one, so
   * this never appears without a `workflowId`.
   */
  business?: {
    registrationNumber: string;
    registrationName?: string;
    product?: string;
    /**
     * Contact email for key-people verification — the server emails this
     * address the invite links when the workflow's `keyPeople.invite.channel`
     * is 'email' and a role needs full KYC. Sent only when non-empty.
     */
    contactEmail?: string;
    /** Company profile (the collectCompanyInfo fields) — echoed on the org's
     *  webhook and address-matched against the registry. */
    address?: string;
    email?: string;
    phone?: string;
    website?: string;
    /** Uploaded supporting documents (honoured only when the workflow's
     *  `business.documents` block configures them). */
    documents?: Array<{ type: string; mediaId: string }>;
    /** Applicant-declared directors & owners (≤20; `email` drives auto-sent
     *  invites; honoured only when the workflow sets `keyPeople.collect`). */
    keyPeople?: Array<{
      name: string;
      role: string;
      email?: string;
      /** The person's ISO-2 country — drives their verification link's country. */
      country?: string;
      ownershipPct?: number;
      /** This entry IS the applicant (picked on the applicant-role step) —
       *  the server merges it with the applicant row: one person, one KYC,
       *  one screening, no invite. */
      isApplicant?: boolean;
    }>;
    /** The applicant's declared role (+ optional name — the server backfills it
     *  from their verified KYC when absent). */
    applicant?: { role: string; name?: string };
  };
  /**
   * eMRTD chip data, base64. The server runs PASSIVE AUTHENTICATION on it —
   * hashing DG1 against the signed security object and verifying the document
   * signer — and only the server may conclude a chip is genuine. `chipAuth`
   * reports how the chip was unlocked and is informational.
   */
  nfc?: { dg1: string; sod?: string; dg2?: string; chipAuth?: string };
  /** The workflow that drove this flow — attributes the submission to it. */
  workflowId?: string;
  /**
   * Single-use proofs from the contact-verification steps. The server drops an
   * invalid or expired proof; a workflow that REQUIRES one 422s without it.
   */
  contact?: { emailToken?: string; phoneToken?: string };
  /**
   * Compliance answers, validated server-side against the PUBLISHED
   * questionnaire definition. Sent without a workflow they are discarded —
   * there is no definition to trust them against.
   */
  questionnaire?: Record<string, string | number | boolean | string[]>;
  metadata: {
    requestId: string;
    device?: Record<string, unknown>;
    [key: string]: unknown;
  };
}
