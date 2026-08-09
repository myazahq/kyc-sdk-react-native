import type { HybridObject } from 'react-native-nitro-modules';

// ---------------------------------------------------------------------------
// Nitro spec for eMRTD chip reading: the NFC transport, plus the crypto
// primitives the protocol is built from.
//
// WHY THE CRYPTO IS NATIVE. The protocol logic — APDU construction, TLV
// parsing, secure messaging, key derivation, passive authentication — lives in
// TypeScript, where it is testable against ICAO 9303's own worked examples
// without a passport in hand. But the PRIMITIVES (3DES, AES, SHA, CMAC) come
// from the platform: CommonCrypto on iOS, javax.crypto on Android. Both are
// audited, constant-time where it matters, and hardware-accelerated. A
// hand-written DES in JavaScript would be slower and, far worse, a novel
// implementation on a path that authenticates a passport.
//
// Everything crosses the bridge as base64, because Nitro has no byte-array
// type and hex would double the payload of a 256KB DG2.
// ---------------------------------------------------------------------------

/** How the chip was unlocked. */
export type EmrtdAccessMethod = 'bac' | 'pace' | 'none';

export interface EmrtdTagInfo {
  /** True once a chip is in range and an ISO-DEP channel is open. */
  connected: boolean;
  /** Card UID, base64. Diagnostic only — never an identity signal. */
  uid: string;
}

export interface EmrtdApduResponse {
  /** Response data (no status word), base64. */
  data: string;
  /** SW1<<8 | SW2. 0x9000 is success; 0x63CF and 0x6Cxx are meaningful too. */
  statusWord: number;
}

export interface MyazaEmrtd extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** Whether this device has NFC hardware capable of ISO-DEP. */
  isAvailable(): boolean;

  /**
   * Begin a session and wait for a chip.
   *
   * `alertMessage` is shown in iOS's system NFC sheet; Android has no
   * equivalent and ignores it.
   */
  startSession(alertMessage: string): Promise<EmrtdTagInfo>;

  /** End the session. Safe to call when none is open. */
  stopSession(message: string): Promise<void>;

  /**
   * Update the live session's user-facing message.
   *
   * iOS narrates the read on its system sheet — which covers the app, so this
   * is the ONLY feedback an iOS user gets between "hold your phone here" and
   * the result. Android has no system NFC UI and ignores it (the SDK's own
   * screen narrates there). Safe to call when no session is open.
   */
  updateSessionMessage(message: string): Promise<void>;

  /**
   * Send one APDU and return the response.
   *
   * A transport error rejects; a chip that answers with a non-success status
   * word RESOLVES with that word, because those are protocol answers the
   * caller must interpret rather than failures.
   */
  transceive(apduBase64: string): Promise<EmrtdApduResponse>;

  /**
   * Decode an image the JS side cannot render, returning JPEG bytes.
   *
   * The one that matters is JPEG 2000: most passport chips store their portrait
   * (DG2) that way and React Native has no decoder for it, so the photo the
   * issuing government put on the chip could be read and verified but never
   * shown. The platform does have one — iOS registers `public.jpeg-2000` with
   * ImageIO, Android with BitmapFactory.
   *
   * Returns an EMPTY STRING rather than null when the format is not understood
   * — Nitro maps a nullable string to a variant type, which costs both native
   * sides an unwrapping dance for a value whose only meaning is "no picture".
   * Never throws: the portrait is a courtesy preview and the chip read stands on
   * its own without it.
   */
  decodeImage(dataBase64: string): Promise<string>;

  // ── Crypto primitives ─────────────────────────────────────────────────────

  /** SHA-1 digest, base64 in and out. */
  sha1(dataBase64: string): string;
  /** SHA-256 digest. */
  sha256(dataBase64: string): string;

  /**
   * Two-key 3DES (K1|K2|K1) in CBC mode.
   *
   * `ivBase64` is empty for the zero IV that BAC uses. No padding is applied —
   * ISO 9797-1 method 2 padding is the protocol's job, not the cipher's.
   */
  desEde2Cbc(keyBase64: string, dataBase64: string, ivBase64: string, encrypt: boolean): string;

  /** Single DES on ONE block — the retail MAC's inner primitive. */
  desBlock(keyBase64: string, blockBase64: string, encrypt: boolean): string;

  /** AES-CBC, for the AES cipher suites PACE may negotiate. */
  aesCbc(keyBase64: string, dataBase64: string, ivBase64: string, encrypt: boolean): string;

  /** AES-CMAC (RFC 4493), truncated by the caller as ICAO specifies. */
  aesCmac(keyBase64: string, dataBase64: string): string;

  /** Cryptographically secure random bytes — the BAC challenge depends on it. */
  randomBytes(length: number): string;
}
