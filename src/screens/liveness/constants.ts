// ---------------------------------------------------------------------------
// Layout constants and timings shared across the liveness step's pieces.
// ---------------------------------------------------------------------------

export const StyleAbsFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/**
 * How long to wait for the face to reappear before abandoning a capture.
 *
 * Generous: a full-screen colour flash can make a face momentarily
 * undetectable, and giving up on one dropped frame would restart a sequence the
 * user is still correctly inside.
 */
export const FRESH_FACE_TIMEOUT_MS = 1500;

/**
 * Reserved height of the instruction line. Fixed so the circle does not jump as
 * the wording changes.
 */
export const INSTRUCTION_HEIGHT = 26;

// Lighting warning palette — 1:1 with the Flutter `_LightingWarningBanner`.
export const AMBER_50 = '#FFFBEB';
export const AMBER_200 = '#FDE68A';
export const AMBER_800 = '#92400E';
