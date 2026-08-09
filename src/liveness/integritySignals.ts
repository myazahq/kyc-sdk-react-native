import type { FlashResult } from './flashDetector';
import type { LivenessMode } from './types';

// ---------------------------------------------------------------------------
// Capture-integrity signals.
//
// What the client observed while capturing, sent as context alongside the
// verification. The server persists these on `deviceMetadata.integrity` and —
// crucially — re-analyses the recorded liveness video against the flash
// SEQUENCE claimed here. That check is why the claim matters: a client can
// report whatever it likes, but it cannot make a video reflect colours it never
// emitted.
//
// So none of this is trusted as a verdict. It is the claim the server audits.
// ---------------------------------------------------------------------------

export interface LivenessIntegrity {
  mode: LivenessMode;
  /** How many consecutive-frame discontinuities the continuity guard saw. */
  faceGlitches: number;
  flash?: {
    passed: boolean;
    score: number;
    matched: number;
    total: number;
    inconclusive: boolean;
    /** The colours emitted, in order — what the server checks the video for. */
    sequence: string[];
  };
}

export interface CaptureIntegrity {
  liveness: LivenessIntegrity;
}

export function buildLivenessIntegrity(
  mode: LivenessMode,
  faceGlitches: number,
  flash: FlashResult | null,
): LivenessIntegrity {
  return {
    mode,
    faceGlitches,
    ...(flash
      ? {
          flash: {
            passed: flash.passed,
            score: flash.score,
            matched: flash.matched,
            total: flash.total,
            // Collapsed to a boolean for the wire: the server only needs to
            // know whether the run was unmeasurable, not how many individual
            // flashes were drowned.
            inconclusive: flash.total > 0 && flash.inconclusive === flash.total,
            sequence: flash.sequence,
          },
        }
      : {}),
  };
}
