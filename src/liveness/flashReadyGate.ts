// ---------------------------------------------------------------------------
// Flash-ready gate — decides WHEN a flash-only sequence may start.
//
// Pure logic, no camera and no component, so the timing is unit-tested rather
// than tuned on a device.
//
// It exists because flash-only mode otherwise flashes the instant a face is at
// a good distance, off a SINGLE frame, before lighting has been confirmed. That
// is survivable in the gesture flow — the challenges take seconds and re-check
// framing throughout — but flash mode has no such buffer: nothing follows the
// flash, so the "come closer / more light" guidance never gets a chance to show
// and the screen flashes at a face that was merely passing through frame.
//
// Three conditions, each earning its place:
//   • FRAMED  — the face is at the right distance (no position warning).
//   • LIT     — no lighting warning. But "no warning" is ambiguous until the
//     brightness sampler has produced a reading: during warm-up lighting is
//     UNKNOWN, not confirmed-good, so a dim room would read as fine and flash
//     with no "more light" prompt. Hence `lightingConfirmed` gates separately.
//   • DWELL   — framed+lit held CONTINUOUSLY for a visible moment, so a face
//     crossing through the right distance doesn't trigger, and the guidance and
//     a "hold still" beat land before the screen lights up.
//
// Ported from the Flutter SDK's FlashReadyGate — keep the two in step.
// ---------------------------------------------------------------------------

/** How long framed+lit must hold before flashing. */
export const FLASH_READY_DWELL_MS = 1200;

/**
 * Safety valve: if framing is good but the sampler NEVER confirms lighting
 * (sampling unsupported or failing on this device), proceed anyway after this
 * so the user is never stuck on a permanent "hold still".
 *
 * Longer than the dwell AND the sampler's warm-up, so a healthy device always
 * confirms lighting first and this never fires in the normal case.
 */
export const FLASH_LIGHTING_WAIT_MS = 3000;

/** The gate's verdict for one frame. */
export interface FlashReadyState {
  /** Start the flash now. */
  ready: boolean;
  /** 0..1 across the dwell, for a "getting ready" indicator. */
  progress: number;
}

const NOT_READY: FlashReadyState = { ready: false, progress: 0 };

/**
 * Tracks the framed+lit hold across frames. One instance per liveness attempt;
 * `reset()` reuses it for a retry.
 */
export class FlashReadyGate {
  private heldSince: number | null = null;

  constructor(
    private readonly dwellMs: number = FLASH_READY_DWELL_MS,
    private readonly lightingWaitMs: number = FLASH_LIGHTING_WAIT_MS,
  ) {}

  reset(): void {
    this.heldSince = null;
  }

  /**
   * Feed one frame's verdict.
   *
   * @param framed            face at the right distance (no position warning)
   * @param lit               no lighting warning — note this is also true while
   *                          lighting is still UNKNOWN, which is why
   *                          `lightingConfirmed` is separate
   * @param lightingConfirmed the sampler has produced at least one real reading
   * @param now               injected clock, so tests are deterministic
   */
  update({
    framed,
    lit,
    lightingConfirmed,
    now,
  }: {
    framed: boolean;
    lit: boolean;
    lightingConfirmed: boolean;
    now: number;
  }): FlashReadyState {
    // Any break in framing or lighting restarts the hold — the point is a
    // CONTINUOUS steady moment, not a cumulative one.
    if (!framed || !lit) {
      this.heldSince = null;
      return NOT_READY;
    }

    if (this.heldSince === null) this.heldSince = now;
    const held = now - this.heldSince;

    // Lighting still unmeasured: keep holding, but don't hold forever on a
    // device whose sampler never reports.
    if (!lightingConfirmed && held < this.lightingWaitMs) {
      return { ready: false, progress: Math.min(held / this.dwellMs, 0.99) };
    }

    if (held >= this.dwellMs) return { ready: true, progress: 1 };
    return { ready: false, progress: held / this.dwellMs };
  }
}
