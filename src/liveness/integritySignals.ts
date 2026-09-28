import type { FlashResult } from './flashDetector';
import { flashUnmeasurable } from './flashOutcome';
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
  /**
   * The prompts this run used, in order (e.g. ['turn', 'blink']). The server's
   * shape-from-movement verdict depends on whether a turn was asked for.
   */
  challenges?: string[];
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

/**
 * Why the liveness recording is missing. Stable and add-only, shared with the
 * web and Flutter SDKs; the server stores it on `Verification.livenessCapture`.
 */
export type LivenessVideoFailure =
  | 'recorder_unsupported'
  | 'recorder_start_failed'
  | 'recording_empty'
  | 'compression_failed'
  | 'upload_failed'
  | 'recording_missing';

export interface LivenessVideoReport {
  recorded: boolean;
  failure?: LivenessVideoFailure;
}

export interface CaptureIntegrity {
  liveness: LivenessIntegrity & { video?: LivenessVideoReport };
}

export function buildLivenessIntegrity(
  mode: LivenessMode,
  faceGlitches: number,
  flash: FlashResult | null,
  challenges?: readonly string[],
): LivenessIntegrity {
  return {
    mode,
    ...(challenges ? { challenges: [...challenges] } : {}),
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
            // True when NO flash could be measured, including a sequence that
            // could not run at all (total 0) — which reported false here and
            // read on the server as a measured failure.
            inconclusive: flashUnmeasurable(flash),
            sequence: flash.sequence,
          },
        }
      : {}),
  };
}
