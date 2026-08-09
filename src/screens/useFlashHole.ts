import { useCallback, useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';

import type { FlashHole } from '../components/flashHoleGeometry';

// ---------------------------------------------------------------------------
// Where the preview circle actually sits on the physical screen.
//
// The flash paints in a full-screen modal over the sheet, so the hole has to be
// given in window coordinates — it cannot be derived from the step's own
// spacing constants.
//
// Measuring ONCE is not enough, and this is the subtle part: iOS stacks a
// presenting sheet BACK when a modal is presented over it. The sheet scales
// down and shifts, so the preview MOVES as a direct consequence of showing the
// overlay that is measuring it. A single reading taken before or during that
// animation describes a position the preview has already left — the observed
// result was a hole both larger than the preview and higher up, off by exactly
// the transform.
//
// So it re-measures until the answer stops changing, then stops. Nothing else
// on screen moves during a flash (guidance banners are suppressed), so a
// settled value stays valid for the rest of the sequence.
//
// Failure is not fatal: a null hole paints a solid flash, which still lights
// the face. See FlashOverlay.
// ---------------------------------------------------------------------------

/** How often to re-read while the position is still settling. */
const POLL_MS = 120;

/**
 * How long to keep watching. Comfortably longer than the sheet-stacking
 * animation, and it stops early as soon as two readings agree.
 */
const SETTLE_WINDOW_MS = 1000;

/** Sub-pixel differences are not movement. */
const EPSILON = 0.5;

function same(a: FlashHole | null, b: FlashHole): boolean {
  return (
    a !== null &&
    Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.y - b.y) < EPSILON &&
    Math.abs(a.size - b.size) < EPSILON
  );
}

export function useFlashHole(active: boolean): {
  ref: React.RefObject<View | null>;
  hole: FlashHole | null;
} {
  const ref = useRef<View | null>(null);
  const [hole, setHole] = useState<FlashHole | null>(null);
  const latest = useRef<FlashHole | null>(null);

  const measure = useCallback((onSettled: () => void) => {
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      // A zero-sized measurement means the view is not laid out yet; punching a
      // hole there would leave a gap in the wrong place, which is worse than
      // painting solid.
      if (!width || !height) return;
      // The preview is a circle in a square box, so the smaller side is the
      // diameter — guards against a reading taken mid-layout.
      const next = { x, y, size: Math.min(width, height) };
      if (same(latest.current, next)) {
        onSettled();
        return;
      }
      latest.current = next;
      setHole(next);
    });
  }, []);

  useEffect(() => {
    if (!active) {
      latest.current = null;
      setHole(null);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const stop = (): void => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
    const deadline = Date.now() + SETTLE_WINDOW_MS;

    const tick = (): void => {
      if (stopped) return;
      measure(stop);
      if (!stopped && Date.now() < deadline) timer = setTimeout(tick, POLL_MS);
    };

    // One frame's grace so the flash phase's own render has committed.
    timer = setTimeout(tick, 0);
    return stop;
  }, [active, measure]);

  return { ref, hole };
}
