import { SDK_VERSION } from './deviceMetadata';
import type {
  AddressReverseResult,
  AddressSearchHit,
  BusinessRegionsResponse,
  BusinessSearchResponse,
  BusinessSelectResponse,
  ContactCheckResponse,
  NfcChallengeResponse,
  ContactSendResponse,
  HealthResponse,
  MediaUploadType,
  PlaceSuggestion,
  ResolvedPlace,
  SdkConfigResponse,
  SessionStartResponse,
  SessionSummaryResponse,
  UploadFile,
  UploadResponse,
  VerificationStatusResponse,
  VerifyRequest,
  VerifyResponse,
  WorkflowResolutionResponse,
} from './api-types';
import { biometricCalls } from './api-biometric';

// The HTTP contract lives in ./api-types and is re-exported here, so importers
// keep a single entry point for both the client and the shapes it exchanges.
export * from './api-types';

// ---------------------------------------------------------------------------
// HTTP client — talks to the only endpoints the SDK calls (upload / verify /
// status / config / health). Mirrors the web SDK's `services/api.ts`. Multipart
// uploads append a real `Blob` (read from the local file URI via `uriToBlob`),
// NOT the classic RN `{ uri, name, type }` part — Expo SDK 54+ installs a
// WinterCG `fetch` whose serializer rejects the `{ uri }` form.
// ---------------------------------------------------------------------------

export class KYCApiError extends Error {
  statusCode: number;
  code?: string;
  body?: Record<string, unknown>;

  constructor(message: string, statusCode: number, code?: string, body?: Record<string, unknown>) {
    super(message);
    this.name = 'KYCApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.body = body;
    Object.setPrototypeOf(this, KYCApiError.prototype);
  }
}

function baseHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'X-SDK-Version': SDK_VERSION,
  };
}

/**
 * Read a local file URI (`file://…`, `content://…`, `ph://…`) into a Blob.
 *
 * Uses `XMLHttpRequest` (not the global `fetch`) on purpose: React Native's XHR
 * has built-in blob support for local URIs and is NOT shadowed by the WinterCG
 * `fetch` Expo installs — so this works regardless of which `fetch` is global.
 * The resulting Blob is what the multipart upload appends (Expo-fetch's
 * serializer accepts a Blob; the classic RN `{ uri }` part it rejects).
 */
function uriToBlob(uri: string, mimeType: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', uri, true);
    xhr.responseType = 'blob';
    xhr.onload = () => {
      const blob = xhr.response as Blob | null;
      if (blob) {
        // ALWAYS re-type the part, never only when the platform inferred
        // nothing. Its guess comes from the URI's extension and describes the
        // file we PICKED, not the one we are sending: an iPhone gallery photo
        // arrives as HEIC, gets transcoded to JPEG on the way here, and the
        // part still went out labelled image/heic — which the server refuses,
        // so most camera-roll uploads failed with a message that blamed the
        // document. `mimeType` is the normalised type the bytes actually are.
        resolve(blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType));
      } else {
        reject(new Error(`Could not read file at ${uri}`));
      }
    };
    xhr.onerror = () => reject(new Error(`Failed to read file at ${uri}`));
    xhr.send();
  });
}

async function handleResponse<T>(res: Response): Promise<T> {
  // Some endpoints return an empty body — read as text first so JSON.parse
  // isn't called on "" (which throws).
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const errObj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    const message = String(errObj.message ?? errObj.error ?? `Request failed with status ${res.status}`);
    const code = typeof errObj.error === 'string' ? errObj.error : undefined;
    throw new KYCApiError(message, res.status, code, errObj);
  }
  return data as T;
}

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const VIDEO_MIME_TYPES = ['video/webm', 'video/mp4'] as const;
const POA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
};

/**
 * Drop codec params from a file's type (e.g. `video/mp4;codecs=...` →
 * `video/mp4`) and fall back to a sane default per media kind when the value
 * isn't one the server recognizes. RN cameras record mp4, so videos default
 * to `video/mp4` (the web SDK defaults to `video/webm`).
 */
function normalizeMimeType(rawType: string | undefined, type: MediaUploadType): string {
  const base = (rawType?.split(';')[0] ?? '').trim().toLowerCase();
  const isVideo = type.endsWith('_video');
  const isPoa = type === 'proof_of_address' || type === 'business_document';
  const allowed: readonly string[] = isVideo
    ? VIDEO_MIME_TYPES
    : isPoa
      ? POA_MIME_TYPES
      : IMAGE_MIME_TYPES;
  if (allowed.includes(base)) return base;
  return isVideo ? 'video/mp4' : 'image/jpeg';
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createKYCApi(baseUrl: string, apiKey: string) {
  const base = `${baseUrl}/api/kyc`;
  const headers = baseHeaders(apiKey);

  // JSON request to our own server (verify, status, config, health).
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    return handleResponse<T>(res);
  }

  return {
    ...biometricCalls(request),

    /**
     * Single multipart upload: the local file is POSTed to our server, which
     * stores it and returns the `mediaId` referenced later by /verify.
     */
    async upload(file: UploadFile, type: MediaUploadType, maxBytes?: number): Promise<string> {
      const mimeType = normalizeMimeType(file.type, type);
      const name = file.name ?? `${type}.${MIME_EXTENSIONS[mimeType]}`;
      const form = new FormData();

      // Read the local file (`file://…`) into a Blob and append THAT, not a
      // `{ uri, name, type }` object. Expo SDK 54+ installs a WinterCG `fetch`
      // whose multipart serializer (expo/src/winter/fetch/convertFormData) only
      // accepts string | Blob | { bytes() } and throws "Unsupported FormDataPart
      // implementation" on the classic RN `{ uri }` part. A Blob satisfies both
      // Expo-fetch and React Native's own networking. The Blob carries its own
      // content-type; pass the filename as the 3rd append arg.
      const blob = await uriToBlob(file.uri, mimeType);
      // Hard size ceiling (used for best-effort videos): reject locally rather than
      // wasting an upload the server will refuse. A 4xx KYCApiError is terminal, so
      // withRetry won't retry it and the caller drops the media.
      if (maxBytes != null && blob.size > maxBytes) {
        throw new KYCApiError(
          `File too large (${(blob.size / 1024 / 1024).toFixed(1)}MB > ${(maxBytes / 1024 / 1024).toFixed(0)}MB)`,
          413,
          'file_too_large',
        );
      }
      form.append('file', blob, name);
      form.append('type', type);

      // Don't set Content-Type — the fetch impl adds the multipart boundary.
      const res = await fetch(`${base}/upload`, {
        method: 'POST',
        headers,
        body: form,
      });
      const { mediaId } = await handleResponse<UploadResponse>(res);
      return mediaId;
    },

    async verify(body: VerifyRequest): Promise<VerifyResponse> {
      return request<VerifyResponse>('/verify', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    async status(verificationId: string): Promise<VerificationStatusResponse> {
      return request<VerificationStatusResponse>(`/status/${verificationId}`);
    },

    /**
     * Send a contact-verification OTP. Non-production environments never
     * deliver a real message — the code is all zeros of `codeLength`, so an
     * integrator can automate the flow for free.
     */
    async contactSend(body: {
      channel: 'email' | 'phone';
      destination: string;
      /** ISO-2 default country for national phone formats (the flow's country). */
      country?: string;
      /** Phone delivery channel preference (default sms). */
      via?: 'sms' | 'whatsapp';
      /** Org-configured code length (server clamps 4–8). */
      codeLength?: number;
      /** Org-configured attempt budget (server clamps 1–5). */
      maxAttempts?: number;
    }): Promise<ContactSendResponse> {
      return request<ContactSendResponse>('/contact/send', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    /** Check a typed code. The returned `token` is a single-use proof that
     *  rides the /verify submission. */
    async contactCheck(body: { challengeId: string; code: string }): Promise<ContactCheckResponse> {
      return request<ContactCheckResponse>('/contact/check', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    /**
     * A fresh Active-Authentication challenge for a chip read — the nonce the
     * chip signs to prove it is the original document rather than a copy of
     * one. It has to come from the SERVER: a nonce the client chose would let
     * a captured signature be replayed forever, which is the clone the check
     * exists to catch. Best-effort by contract at every call site — a chip
     * read without one is exactly the read we did before.
     */
    async nfcChallenge(): Promise<NfcChallengeResponse> {
      return request<NfcChallengeResponse>('/nfc/challenge', { method: 'POST' });
    },

    async config(signal?: AbortSignal): Promise<SdkConfigResponse> {
      return request<SdkConfigResponse>('/config', signal ? { signal } : {});
    },

    /**
     * Resolve a published workflow. Returns the flow's config plus the org's
     * ID-type allowlist and branding, so a `workflowId` mount needs no
     * subsequent `/config` call.
     */
    async workflow(workflowId: string, signal?: AbortSignal): Promise<WorkflowResolutionResponse> {
      return request<WorkflowResolutionResponse>(
        `/workflows/${encodeURIComponent(workflowId)}`,
        signal ? { signal } : {},
      );
    },

    /**
     * Begin (or resume) a verification ATTEMPT session. Best-effort by
     * contract: sessions power resumability, the dashboard's live attempt
     * view, and the registry check at selection — verifying is never
     * conditional on one existing.
     */
    async startSession(input: {
      externalUserId?: string;
      workflowId?: string;
      /** Persistent device id — the anonymous-mount resume fallback. */
      deviceRef?: string;
      /** The same device block the submission sends, so the dashboard's
       *  in-progress row shows the device and SDK from the moment the SDK
       *  loads rather than after the applicant finishes (2026-09-08). */
      device?: Record<string, unknown>;
    }): Promise<SessionStartResponse> {
      return request<SessionStartResponse>('/session/start', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    /**
     * A submitted session, rebuilt server-side — the reconciled key-people
     * list the success screen polls. Same body a hosted link reads by token,
     * so mobile and hosted success screens cannot tell different stories
     * about one application.
     */
    async sessionSummary(sessionId: string): Promise<SessionSummaryResponse> {
      return request<SessionSummaryResponse>(`/session/${sessionId}/summary`);
    },

    /**
     * Save where the user has got to. Losing a save costs some re-typing on
     * resume and must never interrupt them now — callers swallow failures.
     */
    async saveProgress(sessionId: string, progress: unknown): Promise<void> {
      await request(`/session/${encodeURIComponent(sessionId)}/progress`, {
        method: 'PUT',
        body: JSON.stringify(progress),
      });
    },

    /**
     * Find a business by name. FREE — no provider charge here or upstream, so
     * the applicant may look as many times as they need. Throws on a provider
     * failure so the caller can show "unavailable" rather than an empty list,
     * which would read as "this business is not registered".
     */
    async businessSearch(params: {
      country: string;
      subdivisionCode?: string;
      query: string;
      limit?: number;
    }): Promise<BusinessSearchResponse> {
      const qs = new URLSearchParams({ country: params.country, query: params.query });
      if (params.subdivisionCode) qs.set('subdivisionCode', params.subdivisionCode);
      if (params.limit) qs.set('limit', String(params.limit));
      return request<BusinessSearchResponse>(`/business/search?${qs.toString()}`);
    },

    /** Registry regions for a country. Empty when it has a single register. */
    async businessRegions(country: string): Promise<BusinessRegionsResponse> {
      return request<BusinessRegionsResponse>(
        `/business/regions?country=${encodeURIComponent(country)}`,
      );
    },

    /**
     * The PAID registry check for the company the applicant identified, run at
     * selection so the register's key people come back BEFORE the form asks
     * for them. Never fails the flow: a short balance, unconfigured pricing or
     * a spent lookup budget returns `checked: false` and the lookup happens at
     * submit as before.
     */
    async businessSelect(body: {
      sessionId: string;
      country: string;
      subdivisionCode?: string;
      product?: string;
      registrationNumber: string;
      registrationName?: string;
      sandboxOutcome?: string;
    }): Promise<BusinessSelectResponse> {
      return request<BusinessSelectResponse>('/business/select', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    /**
     * Forward address search for the address step's search box.
     *
     * EXPLICIT SUBMIT ONLY — never call this per keystroke. The server's map
     * source forbids autocomplete, and the request budget has to be spent on
     * the query the person actually meant rather than on every prefix of it.
     */
    async addressSearch(
      query: string,
      country?: string | null,
    ): Promise<{ results: AddressSearchHit[] }> {
      const qs = new URLSearchParams({ q: query });
      if (country) qs.set('country', country);
      return request<{ results: AddressSearchHit[] }>(`/address/search?${qs.toString()}`);
    },

    /**
     * The framed Street View entrance, as an image SOURCE the review card can
     * hand straight to <Image>.
     *
     * The browser key never reaches this SDK (the framed page holds it), so
     * the picture comes through the server, which does. Returned as a URL plus
     * the auth header rather than fetched bytes: React Native's Image carries
     * headers itself, which keeps Blob, FileReader and base64 out of a path
     * that only has to draw a thumbnail. Mirrors the web SDK's
     * addressStreetViewPreview, which returns a Blob because a browser <img>
     * cannot send an Authorization header.
     */
    /**
     * The pinned location as a PICTURE, for the review card.
     *
     * A confirmation screen wants a photograph of the place, not a second
     * instrument: a live map there invites a drag that goes nowhere and
     * carries the vendor's own controls over the SDK's chrome. Same shape as
     * the Street View source above, and the same reason for it: the key lives
     * on the server. lib/authed-image fetches it with the header — an <Image>
     * given `source.headers` drops them on Android.
     */
    staticMapSource(view: {
      lat: number;
      lng: number;
      zoom?: number;
      width?: number;
      height?: number;
    }): { uri: string; headers: Record<string, string> } {
      const qs = new URLSearchParams({
        lat: String(view.lat),
        lng: String(view.lng),
        zoom: String(view.zoom ?? 16),
        width: String(Math.round(view.width ?? 640)),
        height: String(Math.round(view.height ?? 360)),
      });
      return { uri: `${base}/address/static-map?${qs.toString()}`, headers };
    },

    streetViewPreviewSource(frame: {
      panoId: string;
      heading: number;
      pitch: number;
      fov: number;
    }): { uri: string; headers: Record<string, string> } {
      const qs = new URLSearchParams({
        panoId: frame.panoId,
        heading: String(frame.heading),
        pitch: String(frame.pitch),
        fov: String(frame.fov),
      });
      return {
        uri: `${base}/address/street-view-preview?${qs.toString()}`,
        headers,
      };
    },

    /** The street line for a pin, for the summary card after a locate or a
     *  drag. Display only — it never decides anything. */
    async addressReverse(lat: number, lng: number): Promise<AddressReverseResult> {
      const qs = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      return request<AddressReverseResult>(`/address/reverse?${qs.toString()}`);
    },

    /**
     * Places-backed as-you-type suggestions.
     *
     * `session` is ONE token per typing session: it is the billing unit, so
     * Google bills per session rather than per keystroke. Mint it when the
     * search screen opens, reuse it for every keystroke, and mint a fresh one
     * after a details call — that call closes the session.
     */
    async addressAutocomplete(
      query: string,
      session: string,
      country?: string | null,
      near?: { lat: number; lng: number } | null,
    ): Promise<{ suggestions: PlaceSuggestion[] }> {
      const qs = new URLSearchParams({ q: query, session });
      if (country) qs.set('country', country);
      // The device fix, a RANKING bias so nearby streets come first: without
      // it "Awolowo Road" in Calabar ranks against every Awolowo Road in the
      // country. Mirrors the web SDK's api.addressAutocomplete.
      if (near) {
        qs.set('lat', String(near.lat));
        qs.set('lng', String(near.lng));
      }
      return request<{ suggestions: PlaceSuggestion[] }>(`/address/autocomplete?${qs.toString()}`);
    },

    /** Resolve a picked suggestion to coordinates + structured pieces. */
    async addressPlace(placeId: string, session: string): Promise<{ place: ResolvedPlace }> {
      const qs = new URLSearchParams({ session });
      return request<{ place: ResolvedPlace }>(
        `/address/place/${encodeURIComponent(placeId)}?${qs.toString()}`,
      );
    },

    async health(): Promise<HealthResponse> {
      // Public endpoint — no auth needed, but the shared headers are harmless.
      return request<HealthResponse>('/health');
    },
  };
}

export type KYCApi = ReturnType<typeof createKYCApi>;

