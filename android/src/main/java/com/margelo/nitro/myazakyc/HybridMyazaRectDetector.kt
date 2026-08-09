package com.margelo.nitro.myazakyc

import com.margelo.nitro.camera.HybridFrameSpec

/**
 * Android half of document edge detection — deliberately a NO-OP.
 *
 * ML Kit has no frame-by-frame rectangle detector, and there is no honest way to
 * fake one: a hand-rolled contour finder over camera frames would be slower than
 * the text pass it sits beside and far less reliable, and a detector that
 * reports a box it isn't sure about is worse than none, because auto-capture
 * would shoot on it.
 *
 * So Android's auto-capture rides TEXT recognition alone. That is not a
 * degraded path — the text gate answers framing (from the region the recognised
 * text occupies) and identity (from the printed words) by itself on both
 * platforms; iOS simply gets geometry as an extra corroborating signal.
 *
 * Reporting `found = false` is what makes the shared TypeScript gate fall back
 * cleanly, with no platform branch at the call site.
 */
class HybridMyazaRectDetector : HybridMyazaRectDetectorSpec() {

  override fun detectRect(frame: HybridFrameSpec): DetectedRect =
    DetectedRect(
      found = false,
      x = 0.0,
      y = 0.0,
      width = 0.0,
      height = 0.0,
      aspect = 0.0,
      confidence = 0.0,
    )
}
