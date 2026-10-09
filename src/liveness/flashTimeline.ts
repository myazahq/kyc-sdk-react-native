// ---------------------------------------------------------------------------
// WHEN each flash colour came on, measured from the start of the liveness
// recording.
//
// The server re-reads the recording to check the flash for itself. Without
// these times it has to FIND the sequence in the video, which works when the
// reflection is strong and guesses when it is faint. With them it looks in the
// right place and only has to decide whether the colour was there.
//
// They are a claim like the sequence itself: the server uses them to know
// where to look, never as evidence that anything was reflected.
//
// A recorder takes a moment to write its first frame after it is asked to
// start, so the server allows for an offset.
//
// Mirrors the web SDK (liveness/flash-timeline.ts) and the Flutter SDK
// (liveness/flash_timeline.dart). Change all three together.
// ---------------------------------------------------------------------------

let recordingStartedAt: number | null = null;

/** The liveness recorder went live (or stopped: pass null). `Date.now()`. */
export function markRecordingStart(at: number | null): void {
  recordingStartedAt = at;
}

/**
 * The colour-on times as ms from the start of the recording, or undefined when
 * there is no recording to measure from or a colour never ran. One whole,
 * rising list or nothing: half a timeline would point the server at the wrong
 * colours.
 */
export function flashOnsets(
  onAt: readonly number[],
  colours: number,
  startedAt: number | null = recordingStartedAt,
): number[] | undefined {
  if (startedAt === null || onAt.length !== colours || colours === 0) return undefined;
  const onsets = onAt.map((at) => Math.round(at - startedAt));
  const rising = onsets.every((ms, i) => ms >= 0 && (i === 0 || ms > onsets[i - 1]!));
  return rising ? onsets : undefined;
}
