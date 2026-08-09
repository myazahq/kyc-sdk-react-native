import Foundation
import Vision
import CoreImage
import CoreMedia
import CoreVideo
import VisionCamera
import NitroModules

// ---------------------------------------------------------------------------
// HybridMyazaTextRecognizer — the iOS half of on-device text recognition,
// implementing the nitrogen-generated `HybridMyazaTextRecognizerSpec` from
// src/specs/MyazaTextRecognizer.nitro.ts. The Android half is
// HybridMyazaTextRecognizer.kt (Google ML Kit).
//
// Used for reading the MRZ off a passport or ID card. Returns LINES only —
// parsing lives in TypeScript, where it is testable against the ICAO specimen
// without a device, and where the check digits do the actual deciding.
//
// Two choices matter for MRZ specifically:
//
//   • `.accurate` recognition, not `.fast`. OCR-B at a glancing angle is
//     exactly where fast mode invents characters, and one wrong character
//     fails a check digit — costing a frame at best, and a wrong document
//     number at worst.
//   • Language correction OFF. It is trained on prose and would happily
//     "correct" a passport's filler runs and surname into English words.
// ---------------------------------------------------------------------------

final class HybridMyazaTextRecognizer: HybridMyazaTextRecognizerSpec {

  func recognizeText(frame: any HybridFrameSpec, bottomFraction: Double) throws -> TextResult {
    guard
      let nativeFrame = frame as? NativeFrame,
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else {
      return TextResult(lines: [])
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    // The MRZ alphabet. Vision has no charset restriction, but naming Latin
    // keeps it from trying scripts the document does not use.
    request.recognitionLanguages = ["en-US"]

    // Restrict recognition to the bottom slice, where the MRZ sits. Vision's
    // regionOfInterest is in normalised, BOTTOM-LEFT-origin coordinates, so the
    // bottom fraction of the image starts at y = 0.
    let fraction = min(1.0, max(0.05, bottomFraction))
    if fraction < 1.0 {
      request.regionOfInterest = CGRect(x: 0, y: 0, width: 1, height: fraction)
    }

    // The camera delivers the buffer rotated 90° relative to how the document
    // is held; `.right` puts the text upright for the recogniser. Reading it
    // sideways does not fail loudly — it returns confident nonsense.
    let handler = VNImageRequestHandler(
      cvPixelBuffer: pixelBuffer, orientation: .right, options: [:]
    )

    do {
      try handler.perform([request])
    } catch {
      return TextResult(lines: [])
    }

    guard let observations = request.results else { return TextResult(lines: []) }

    // Top to bottom. Vision's y grows upward, so descending y IS reading order,
    // and the MRZ's two lines have to arrive adjacent and in order for the
    // extractor's grouping to work.
    let ordered = observations.sorted { $0.boundingBox.midY > $1.boundingBox.midY }
    let lines = ordered.compactMap { $0.topCandidates(1).first?.string }

    return TextResult(lines: lines)
  }

  func recognizeTextInImage(uri: String, bottomFraction: Double) throws -> Promise<TextResult> {
    Promise.async {
      // A local file path, with or without the scheme — both forms reach here
      // depending on which picker produced it.
      let path = uri.hasPrefix("file://") ? String(uri.dropFirst(7)) : uri
      guard let image = CIImage(contentsOf: URL(fileURLWithPath: path)) else {
        return TextResult(lines: [])
      }

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = false

      let fraction = min(1.0, max(0.05, bottomFraction))
      if fraction < 1.0 {
        request.regionOfInterest = CGRect(x: 0, y: 0, width: 1, height: fraction)
      }

      // A still from the photo library or camera roll is already upright, so no
      // orientation correction here — unlike the live frame, which arrives
      // rotated by the camera pipeline.
      let handler = VNImageRequestHandler(ciImage: image, options: [:])
      do {
        try handler.perform([request])
      } catch {
        return TextResult(lines: [])
      }

      let ordered = (request.results ?? []).sorted { $0.boundingBox.midY > $1.boundingBox.midY }
      return TextResult(lines: ordered.compactMap { $0.topCandidates(1).first?.string })
    }
  }
}
