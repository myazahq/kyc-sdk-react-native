// ---------------------------------------------------------------------------
// Holding the camera's exposure and white balance still while the flash runs.
//
// A camera left on automatic fights the flash: it sees a red face and shifts
// its white balance away from red, and it sees extra light and lowers its
// exposure. Both shrink the very change the flash check measures, and the
// white balance then swings back after each colour, which looks like the
// opposite colour arriving. Held still, a colour on the screen is a colour on
// the face and nothing else moves.
//
// The liveness camera registers its controller here when it mounts, so the
// flash hook does not need a ref threaded through the whole step.
//
// Mirrors the web SDK (lib/camera-lock.ts). Flutter locks exposure through its
// camera plugin (providers/camera_provider.dart).
// ---------------------------------------------------------------------------

/** The part of VisionCamera's controller this needs. */
export interface SteadyController {
  device: { supportsExposureLocking: boolean; supportsWhiteBalanceLocking: boolean };
  lockCurrentExposure(): Promise<void>;
  lockCurrentWhiteBalance(): Promise<void>;
  /** Hands exposure, focus and white balance back to the camera. */
  resetFocus(): Promise<void>;
}

let current: () => SteadyController | null | undefined = () => null;

/** Called by the liveness camera with a way to reach its controller (null on unmount). */
export function registerLivenessCamera(get: (() => SteadyController | null | undefined) | null): void {
  current = get ?? (() => null);
}

/**
 * Hold exposure and white balance where they are now. Resolves to a function
 * that hands them back; call it however the flash ends. Never throws: a camera
 * that cannot lock, or refuses, simply stays automatic.
 */
export async function holdCameraSteady(
  controller: SteadyController | null | undefined = current(),
): Promise<() => void> {
  if (!controller) return () => {};
  const locks: Promise<void>[] = [];
  try {
    if (controller.device.supportsExposureLocking) locks.push(controller.lockCurrentExposure());
    if (controller.device.supportsWhiteBalanceLocking) locks.push(controller.lockCurrentWhiteBalance());
  } catch {
    /* a controller that throws synchronously is treated like one that refuses */
  }
  if (locks.length === 0) return () => {};
  const held = (await Promise.allSettled(locks)).some((r) => r.status === 'fulfilled');
  if (!held) return () => {};
  return () => {
    try {
      void controller.resetFocus().catch(() => {});
    } catch {
      /* the camera is already gone */
    }
  };
}
