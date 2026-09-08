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
  /** The attempt session this run happened under — the verification adopts its
   *  id, and a registry check paid at selection is not paid again at submit. */
  sessionId?: string;
  idNumber?: string;
  /**
   * Multi-ID: every check in the run, in pick order (2–3). ONE verification
   * comes back, judged by the workflow's pass policy. The top-level
   * idType/idNumber mirror the first entry.
   */
  idChecks?: Array<{
    idType: string;
    idNumber?: string;
    documentFront?: string;
    documentBack?: string;
    /** Each check's OWN document recording. */
    documentFrontVideo?: string;
    documentBackVideo?: string;
    /** This check's own chip read — the chip belongs to a PARTICULAR document. */
    nfc?: VerifyRequest['nfc'];
  }>;
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
    /** Address Intelligence door photo (individual flows only). */
    addressPhoto?: string;
  };
  /** Which kind of document the user said they uploaded as proof of address. */
  proofOfAddressType?: string;
  /**
   * Address Intelligence: the map pin the applicant dropped (+ the optional
   * one-shot device fix taken at Continue). The server corroborates it; the
   * SDK only collects. Sent only when the step ran and a pin was confirmed.
   */
  address?: {
    lat: number;
    lng: number;
    accuracy?: number;
    /**
     * The line the applicant CONFIRMED (a search pick, or a reverse geocode
     * they accepted). The server prefers it for the composed address over its
     * own derivation, whose OSM coverage drops whole streets in our markets.
     */
    label?: string;
    directions?: string;
    propertyName?: string;
    propertyNumber?: string;
    /** A street the applicant typed because no map source knew it. */
    street?: string;
    /** The edit-details claims: unit + area/region corrections. */
    unit?: string;
    neighbourhood?: string;
    city?: string;
    state?: string;
    postcode?: string;
    /** Street View entrance frame — coordinates only; the server fetches the
     *  image with its own key. Never written by this SDK (no panorama on
     *  mobile), but a session begun on a hosted page can carry one. */
    streetView?: { panoId: string; heading: number; pitch: number; fov: number };
    deviceLat?: number;
    deviceLng?: number;
    deviceAccuracy?: number;
    capturedAt?: string;
  };
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
    /** Registry facts the applicant states (the extended collectCompanyInfo
     *  fields) — where they differ from the register, that is the finding. */
    dateOfIncorporation?: string;
    taxId?: string;
    vatNumber?: string;
    companyType?: string;
    natureOfBusiness?: string;
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
  nfc?: {
    dg1: string;
    sod?: string;
    dg2?: string;
    dg7?: string;
    dg11?: string;
    dg12?: string;
    /**
     * DG15 (the chip's Active-Authentication public key) and its signature over
     * the challenge the server issued — the ANTI-CLONE proof. Passive
     * authentication proves the issuing state signed this data; only these
     * prove it is the chip they signed it onto. Verified server-side against a
     * SOD-bound DG15: a client that checked its own chip could be patched.
     */
    dg15?: string;
    aaChallengeId?: string;
    aaSignature?: string;
    chipAuth?: string;
    /**
     * WHY the session is on that protocol. A chip reading over BAC because it
     * offers no PACE is nothing to act on; one reading over BAC because our
     * PACE broke is a bug, and `chipAuth` alone cannot tell them apart.
     * Diagnostic only — the server records it and never judges on it.
     */
    paceOutcome?: string;
    paceDetail?: string;
  };
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
