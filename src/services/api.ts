import { SDK_VERSION } from './deviceMetadata';

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
        // Ensure the part carries the right content-type even if the platform
        // didn't infer one from the URI.
        resolve(blob.type ? blob : blob.slice(0, blob.size, mimeType));
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Media kinds the SDK can upload — document/selfie photos plus best-effort videos. */
export type MediaUploadType =
  | 'document_front'
  | 'document_back'
  | 'selfie'
  | 'document_front_video'
  | 'document_back_video'
  | 'liveness_video';

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

export interface VerifyRequest {
  country: string;
  idType: string;
  idNumber?: string;
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
  };
  metadata: {
    requestId: string;
    device?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface VerifyResponse {
  verificationId: string;
  status: 'pending';
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

export interface HealthResponse {
  status: string;
}

// The mime types the server accepts (must mirror the server's upload allowlist).
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const VIDEO_MIME_TYPES = ['video/webm', 'video/mp4'] as const;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
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
  const allowed: readonly string[] = isVideo ? VIDEO_MIME_TYPES : IMAGE_MIME_TYPES;
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

    async config(): Promise<SdkConfigResponse> {
      return request<SdkConfigResponse>('/config');
    },

    async health(): Promise<HealthResponse> {
      // Public endpoint — no auth needed, but the shared headers are harmless.
      return request<HealthResponse>('/health');
    },
  };
}

export type KYCApi = ReturnType<typeof createKYCApi>;
