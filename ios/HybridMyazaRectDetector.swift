import Foundation
import Vision
import CoreMedia
import CoreVideo
import VisionCamera
import NitroModules

// ---------------------------------------------------------------------------
// HybridMyazaRectDetector — document EDGE detection on iOS, implementing the
// nitrogen-generated `HybridMyazaRectDetectorSpec` from
// src/specs/MyazaRectDetector.nitro.ts.
//
// Apple Vision's `VNDetectRectanglesRequest` answers ONE question: is there
// something document-shaped in frame, and where. It cannot answer which
// document it is — an aspect ratio cannot tell a passport from a driver's
// licence — so auto-capture pairs this with text recognition and requires both
// to agree. On its own it would happily shoot a book, a receipt or a laptop.
//
// There is no Android counterpart: ML Kit has no frame-by-frame rectangle
// detector, so Android's auto-capture rides the text gate alone. That is why
// the text gate answers framing by itself on both platforms, and this is an
// accelerator on top rather than a dependency.
// ---------------------------------------------------------------------------

final class HybridMyazaRectDetector: HybridMyazaRectDetectorSpec {

  /// Reused across frames: building the request per frame is measurable at 30fps.
  private let request: VNDetectRectanglesRequest = {
    let r = VNDetectRectanglesRequest()
    // An ID-1 card is ~1.586:1 and a passport page ~1.42:1; the window is opened
    // wide enough to admit both at an angle, since perspective foreshortens the
    // observed ratio. The TEXT gate is what rejects the wrong document — this
    // only has to find a candidate.
    r.minimumAspectRatio = 0.4
    r.maximumAspectRatio = 1.0
    // A document held up to the camera fills a good share of the frame. Below
    // this it is too far away for OCR to read it anyway.
    r.minimumSize = 0.2
    // Near-square corners. A generous tolerance because the document is rarely
    // exactly parallel to the sensor.
    r.quadratureTolerance = 30
    r.minimumConfidence = 0.6
    // One candidate: the caller wants the document, not every rectangle in the
    // room, and ranking happens below by area.
    r.maximumObservations = 1
    return r
  }()

  private static let notFound = DetectedRect(
    found: false, x: 0, y: 0, width: 0, height: 0, aspect: 0, confidence: 0
  )

  func detectRect(frame: any HybridFrameSpec) throws -> DetectedRect {
    guard
      let nativeFrame = frame as? NativeFrame,
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else {
      return Self.notFound
    }

    // `.right` matches the text recogniser: the camera delivers the buffer
    // rotated 90° relative to how the document is held, and measuring a
    // sideways frame yields a plausible box with the aspect inverted.
    let handler = VNImageRequestHandler(
      cvPixelBuffer: pixelBuffer, orientation: .right, options: [:]
    )

    do {
      try handler.perform([request])
    } catch {
      // A detector that fails on one frame must not take the scan down; the
      // next frame gets its own attempt.
      return Self.notFound
    }

    guard
      let observation = (request.results as? [VNRectangleObservation])?
        .max(by: { $0.boundingBox.width * $0.boundingBox.height
                 < $1.boundingBox.width * $1.boundingBox.height })
    else {
      return Self.notFound
    }

    let box = observation.boundingBox
    guard box.height > 0 else { return Self.notFound }

    // Vision reports a BOTTOM-LEFT origin; the gate's thresholds are written
    // for a top-left origin like every other coordinate in the SDK, so flip y
    // here rather than making every caller remember which convention it got.
    let y = 1.0 - box.origin.y - box.height

    return DetectedRect(
      found: true,
      x: Double(box.origin.x),
      y: Double(y),
      width: Double(box.width),
      height: Double(box.height),
      aspect: Double(box.width / box.height),
      confidence: Double(observation.confidence)
    )
  }
}
