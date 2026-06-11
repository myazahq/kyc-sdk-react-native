import Foundation
import Vision
import CoreMedia
import CoreVideo
import VisionCamera
import NitroModules

// ---------------------------------------------------------------------------
// HybridMyazaFaceDetector — the iOS half of the Myaza KYC face detector, now a
// VisionCamera v5 **Nitro** HybridObject (the v4 FrameProcessorPlugin +
// VISION_EXPORT_SWIFT_FRAME_PROCESSOR macro are gone). Implements the nitrogen-
// generated `HybridMyazaFaceDetectorSpec` from src/specs/MyazaFaceDetector.nitro.ts.
// The Android half is HybridMyazaFaceDetector.kt (Google ML Kit). Both return the
// SAME `FaceResult` shape the TS liveness flow consumes (see liveness/types.ts):
//
//     headEulerAngleX/Y/Z, smilingProbability,
//     leftEyeOpenProbability, rightEyeOpenProbability,
//     faceSizeRatio, faceCount   (faceCount == 0 means "no face")
//
// Direct port of the old v4 plugin's Apple Vision logic. The frame's CVPixelBuffer
// is reached by casting `any HybridFrameSpec` to VisionCamera's public
// `NativeFrame` protocol (→ `sampleBuffer` → image buffer).
//
// Heuristic note (unchanged from v4 — tune on a physical iPhone): yaw/pitch/roll
// come from Vision; eye-open and smile are derived from landmark geometry and
// mapped to ML Kit's 0–1 scale; the `.upMirrored` orientation and the nod pitch
// sign are conservative starting points.
// ---------------------------------------------------------------------------

final class HybridMyazaFaceDetector: HybridMyazaFaceDetectorSpec {
  func detectFace(frame: any HybridFrameSpec) throws -> FaceResult {
    guard
      let nativeFrame = frame as? NativeFrame,
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else {
      return Self.noFace(brightness: 128)
    }

    // Mean frame luma (0–255) for the low-light gate — computed every frame,
    // independent of whether a face is found, so the dark/bright warning shows
    // even before the user is in frame.
    let brightness = Self.averageLuma(pixelBuffer)

    // Front camera, portrait. VisionCamera v5 delivers the buffer rotated 90°
    // vs the v4/Flutter pipeline: `.upMirrored` here gives roll ≈ −105° (face
    // sideways), which scrambles the landmark-derived smile/eye/pitch signals.
    // `.leftMirrored` adds the missing +90°-family rotation so the face lands
    // upright (roll ≈ 0) while keeping the front-camera mirror (yaw stays
    // correct). Tune on device if roll is still off.
    let orientation: CGImagePropertyOrientation = .leftMirrored

    let request = VNDetectFaceLandmarksRequest()
    let handler = VNImageRequestHandler(
      cvPixelBuffer: pixelBuffer, orientation: orientation, options: [:]
    )

    do {
      try handler.perform([request])
    } catch {
      return Self.noFace(brightness: brightness)
    }

    guard
      let faces = request.results, !faces.isEmpty,
      let face = faces.max(by: {
        ($0.boundingBox.width * $0.boundingBox.height)
          < ($1.boundingBox.width * $1.boundingBox.height)
      })
    else {
      return Self.noFace(brightness: brightness)
    }

    let toDeg = 180.0 / Double.pi
    let yawDeg = (face.yaw?.doubleValue ?? 0) * toDeg
    let rollDeg = (face.roll?.doubleValue ?? 0) * toDeg

    // Pitch: Vision's `face.pitch` is iOS 15+ and frequently returns nil/0 for
    // VNDetectFaceLandmarksRequest. Derive a proxy from landmark geometry when
    // it does — looking down pushes the nose UP in normalized landmark space, so
    // we negate to match ML Kit's convention (headEulerAngleX < 0 == down).
    var pitchDeg = 0.0
    if #available(iOS 15.0, *), let p = face.pitch?.doubleValue, p != 0 {
      pitchDeg = p * toDeg
    } else {
      pitchDeg = Self.pitchFromLandmarks(face.landmarks)
    }

    let leftOpen = Self.openProbability(fromEAR: Self.eyeAspectRatio(face.landmarks?.leftEye))
    let rightOpen = Self.openProbability(fromEAR: Self.eyeAspectRatio(face.landmarks?.rightEye))
    let smile = Self.smileProbability(face.landmarks)
    let faceSizeRatio = Double(face.boundingBox.width)

    return FaceResult(
      headEulerAngleX: pitchDeg,
      headEulerAngleY: yawDeg,
      headEulerAngleZ: rollDeg,
      smilingProbability: smile,
      leftEyeOpenProbability: leftOpen,
      rightEyeOpenProbability: rightOpen,
      faceSizeRatio: faceSizeRatio,
      // Number of faces in frame — the TS liveness flow pauses on > 1.
      faceCount: Double(faces.count),
      brightness: brightness
    )
  }

  // "No face" sentinel — faceCount 0 (the worklet maps this to onNoFace), but
  // still carries the frame brightness so the low-light gate works pre-face.
  private static func noFace(brightness: Double) -> FaceResult {
    FaceResult(
      headEulerAngleX: 0, headEulerAngleY: 0, headEulerAngleZ: 0,
      smilingProbability: 0, leftEyeOpenProbability: 1, rightEyeOpenProbability: 1,
      faceSizeRatio: 0, faceCount: 0, brightness: brightness
    )
  }

  /// Mean luma (0–255) of the frame, sampled on a coarse ~64×48 grid for speed.
  /// For a YUV (4:2:0) buffer the first plane IS luma; for non-planar buffers we
  /// approximate from the green channel. Mirrors the Flutter `_BrightnessSampler`.
  private static func averageLuma(_ pixelBuffer: CVPixelBuffer) -> Double {
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

    if CVPixelBufferGetPlaneCount(pixelBuffer) > 0,
       let base = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0) {
      let w = CVPixelBufferGetWidthOfPlane(pixelBuffer, 0)
      let h = CVPixelBufferGetHeightOfPlane(pixelBuffer, 0)
      let rowBytes = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
      let ptr = base.assumingMemoryBound(to: UInt8.self)
      let stepX = max(1, w / 64)
      let stepY = max(1, h / 48)
      var sum = 0.0
      var count = 0
      var y = 0
      while y < h {
        let row = ptr + y * rowBytes
        var x = 0
        while x < w {
          sum += Double(row[x])
          count += 1
          x += stepX
        }
        y += stepY
      }
      return count > 0 ? sum / Double(count) : 128
    }

    // Non-planar (e.g. BGRA) fallback — sample the green byte as a luma proxy.
    guard let base = CVPixelBufferGetBaseAddress(pixelBuffer) else { return 128 }
    let w = CVPixelBufferGetWidth(pixelBuffer)
    let h = CVPixelBufferGetHeight(pixelBuffer)
    let rowBytes = CVPixelBufferGetBytesPerRow(pixelBuffer)
    let ptr = base.assumingMemoryBound(to: UInt8.self)
    let stepX = max(1, w / 64)
    let stepY = max(1, h / 48)
    var sum = 0.0
    var count = 0
    var y = 0
    while y < h {
      let row = ptr + y * rowBytes
      var x = 0
      while x < w {
        sum += Double(row[x * 4 + 1]) // BGRA → green
        count += 1
        x += stepX
      }
      y += stepY
    }
    return count > 0 ? sum / Double(count) : 128
  }

  // MARK: - Landmark heuristics (tune on device)

  private static func eyeAspectRatio(_ region: VNFaceLandmarkRegion2D?) -> Double {
    guard let pts = region?.normalizedPoints, pts.count >= 4 else { return 0.3 }
    var minX = Double.greatestFiniteMagnitude
    var maxX = -Double.greatestFiniteMagnitude
    var minY = Double.greatestFiniteMagnitude
    var maxY = -Double.greatestFiniteMagnitude
    for p in pts {
      minX = min(minX, Double(p.x)); maxX = max(maxX, Double(p.x))
      minY = min(minY, Double(p.y)); maxY = max(maxY, Double(p.y))
    }
    let w = maxX - minX
    let h = maxY - minY
    return w > 0 ? h / w : 0.3
  }

  /// EAR → eye-open probability. EAR ≈ 0.10 (closed) → 0, ≈ 0.30 (open) → 1.
  private static func openProbability(fromEAR ear: Double) -> Double {
    let v = (ear - 0.10) / (0.30 - 0.10)
    return min(max(v, 0.0), 1.0)
  }

  /// Smile from outer-lip width relative to the face. Input band (0.40→0.50):
  /// a neutral mouth sits near 0, a clear smile lands well above the threshold.
  private static func smileProbability(_ landmarks: VNFaceLandmarks2D?) -> Double {
    guard let pts = landmarks?.outerLips?.normalizedPoints, pts.count >= 4 else {
      return 0.0
    }
    var minX = Double.greatestFiniteMagnitude
    var maxX = -Double.greatestFiniteMagnitude
    for p in pts {
      minX = min(minX, Double(p.x)); maxX = max(maxX, Double(p.x))
    }
    let width = maxX - minX
    let score = (width - 0.40) / (0.50 - 0.40)
    return min(max(score, 0.0), 1.0)
  }

  /// Pitch (nod) proxy from landmark geometry, used when Vision's `face.pitch`
  /// is unavailable. Compares the nose vertical position to the eye line in the
  /// face's normalized landmark space (origin bottom-left, y up). Looking DOWN
  /// shrinks the eye→nose gap; mapped to a signed pseudo-degree, negated so down
  /// yields a negative angle — matching ML Kit's headEulerAngleX convention.
  private static func pitchFromLandmarks(_ landmarks: VNFaceLandmarks2D?) -> Double {
    guard let lm = landmarks else { return 0 }
    func meanY(_ r: VNFaceLandmarkRegion2D?) -> Double? {
      guard let pts = r?.normalizedPoints, !pts.isEmpty else { return nil }
      return pts.reduce(0.0) { $0 + Double($1.y) } / Double(pts.count)
    }
    let noseY = meanY(lm.noseCrest) ?? meanY(lm.nose)
    let leftEyeY = meanY(lm.leftEye)
    let rightEyeY = meanY(lm.rightEye)
    guard let n = noseY, let le = leftEyeY, let re = rightEyeY else { return 0 }
    let eyeY = (le + re) / 2.0
    let gap = eyeY - n
    let neutralGap = 0.18
    let degPerUnit = 220.0
    return (gap - neutralGap) * degPerUnit
  }
}
