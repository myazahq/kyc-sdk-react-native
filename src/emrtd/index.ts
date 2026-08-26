// ---------------------------------------------------------------------------
// The eMRTD engine's public surface.
//
// Barrel-only by design (the docbio rule): nothing outside this directory
// reaches into the protocol internals. What escapes is a single call that takes
// the MRZ fields and returns the chip's files, plus the availability check the
// step order needs.
//
// A build without the native module leaves everything unavailable and the chip
// step skips — the same null-degrade posture the rest of the platform uses for
// optional native capabilities.
//
// Layout: native.ts resolves the Nitro module and answers capability
// questions; read.ts owns the session/retry loop; session.ts downward is the
// protocol itself (BAC, secure messaging, file reads), tested against ICAO
// 9303's worked examples in CI.
// ---------------------------------------------------------------------------

export type { EmrtdReadResult } from './session';
export { EmrtdSessionError } from './session';
export type { MrzKeyFields } from './crypto';
export type { NfcReadStage } from './stages';
export {
  NFC_STAGE_ORDER,
  nfcStageDetail,
  nfcStageLabel,
  nfcStageProgress,
} from './stages';
export { parseDg1 } from './dg1';
export { decodeChipImage, isNfcAvailable, nfcUnavailableReason } from './native';
export { cancelChipRead, readPassportChip, type ChipReadOptions } from './read';
export { AA_CHALLENGE_BYTES, readActiveAuth, type AaChallenge, type ActiveAuthRead } from './activeAuth';
