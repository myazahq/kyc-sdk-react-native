// Best-effort UUID/request-id generator. Prefers `expo-crypto`'s native
// randomUUID when available, falling back to a Math.random()-based v4 (good
// enough for a request correlation id — not used for anything security-sensitive).

interface ExpoCryptoModule {
  randomUUID?: () => string;
}

function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function uuid(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('expo-crypto') as ExpoCryptoModule;
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch {
    /* expo-crypto not installed — fall through */
  }
  return fallbackUuid();
}

/** Prefixed request id sent as `metadata.requestId` on every verify. */
export function generateRequestId(): string {
  return `kyc_${uuid()}`;
}
