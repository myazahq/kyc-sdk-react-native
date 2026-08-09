package com.margelo.nitro.myazakyc

import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageProxy
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Android half of the Myaza KYC on-device face detector — now a VisionCamera v5
 * **Nitro** HybridObject (the v4 FrameProcessorPlugin + FrameProcessorPluginRegistry
 * model is gone). Implements the nitrogen-generated `HybridMyazaFaceDetectorSpec`
 * from src/specs/MyazaFaceDetector.nitro.ts. The iOS half is
 * HybridMyazaFaceDetector.swift (Apple Vision). Both return the SAME `FaceResult`
 * shape the TS liveness flow consumes (see liveness/types.ts).
 *
 * Google ML Kit returns head pose + smile + eye-open DIRECTLY (no landmark math),
 * so these map 1:1 onto LivenessFaceData and need no device tuning — unlike the iOS
 * Vision heuristics. Direct port of the old v4 plugin's ML Kit logic, plus the
 * frame-brightness signal (for the low-light gate) computed like the iOS side.
 *
 * The Nitro worklet calls detectFace synchronously, so we run ML Kit's async
 * detector and await the result on the worklet thread with a short bound (FAST mode
 * is well under a frame interval, so this doesn't stall the camera pipeline).
 */
class HybridMyazaFaceDetector : HybridMyazaFaceDetectorSpec() {
  private val detector: FaceDetector = FaceDetection.getClient(
    FaceDetectorOptions.Builder()
      .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
      .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
      .enableTracking()
      .setMinFaceSize(0.15f)
      .build(),
  )

  @ExperimentalGetImage
  override fun detectFace(frame: HybridFrameSpec): FaceResult {
    // Same access pattern as iOS (cast to the public NativeFrame): VisionCamera's
    // frame → CameraX ImageProxy → the underlying android.media.Image for ML Kit.
    val proxy: ImageProxy = (frame as? NativeFrame)?.image ?: return noFace(128.0)
    val brightness = averageLuma(proxy)
    // Mean RGB of the face region, for flash (screen-reflection) liveness.
    // Taken in this same pass because the planes are already mapped — a second
    // native module would walk the whole frame again for numbers available now.
    val faceRgb = averageFaceRgb(proxy)
    val mediaImage = proxy.image ?: return noFace(brightness)

    val rotation = proxy.imageInfo.rotationDegrees
    val input = InputImage.fromMediaImage(mediaImage, rotation)

    var result: FaceResult? = null
    val latch = CountDownLatch(1)
    detector.process(input)
      .addOnSuccessListener { faces ->
        val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
        result = face?.let {
          toResult(it, mediaImage.width, mediaImage.height, rotation, faces.size, brightness, faceRgb)
        }
        latch.countDown()
      }
      .addOnFailureListener { latch.countDown() }

    latch.await(200, TimeUnit.MILLISECONDS)
    return result ?: noFace(brightness)
  }

  private fun toResult(
    face: Face,
    imageWidth: Int,
    imageHeight: Int,
    rotation: Int,
    faceCount: Int,
    brightness: Double,
    faceRgb: Triple<Double, Double, Double>,
  ): FaceResult {
    // After rotation the frame is upright; when rotated 90/270 the stored width/
    // height are swapped, so the smaller dimension is the upright "width".
    val frameWidth = if (rotation == 90 || rotation == 270) imageHeight else imageWidth
    val ratio = (face.boundingBox.width().toDouble() / frameWidth).coerceIn(0.0, 1.0)
    val frameHeight = if (rotation == 90 || rotation == 270) imageWidth else imageHeight
    return FaceResult(
      headEulerAngleX = face.headEulerAngleX.toDouble(),
      headEulerAngleY = face.headEulerAngleY.toDouble(),
      headEulerAngleZ = face.headEulerAngleZ.toDouble(),
      smilingProbability = face.smilingProbability?.toDouble() ?: 0.0,
      leftEyeOpenProbability = face.leftEyeOpenProbability?.toDouble() ?: 0.0,
      rightEyeOpenProbability = face.rightEyeOpenProbability?.toDouble() ?: 0.0,
      faceSizeRatio = ratio,
      faceCount = faceCount.toDouble(),
      brightness = brightness,
      // Face centre, so the TS continuity guard can tell "the same face moved"
      // from "a different face appeared" — size alone cannot, since two people
      // at the same distance measure alike.
      faceCenterX = (face.boundingBox.exactCenterX().toDouble() / frameWidth).coerceIn(0.0, 1.0),
      faceCenterY = (face.boundingBox.exactCenterY().toDouble() / frameHeight).coerceIn(0.0, 1.0),
      // ML Kit's per-face id, stable while it follows the SAME face. A change is
      // PROOF of a different face — something Vision cannot report on iOS — so
      // it strengthens the geometric guard rather than replacing it.
      trackingId = (face.trackingId ?: -1).toDouble(),
      faceR = faceRgb.first,
      faceG = faceRgb.second,
      faceB = faceRgb.third,
    )
  }

  /**
   * Mean RGB (0–255 each) of the centre crop, where the positioning gate has
   * already put the face. Flash liveness measures how that patch of skin
   * reflects each emitted colour.
   *
   * The crop matches the web and iOS SDKs (centre 40% × 50%) so all three — and
   * the server's re-analysis of the recorded video — measure the same region.
   * Sampled from the raw YUV planes rather than converting the frame: a full
   * colour conversion per frame would cost far more than the ~1k samples taken
   * here.
   */
  private fun averageFaceRgb(image: ImageProxy): Triple<Double, Double, Double> {
    val yPlane = image.planes.getOrNull(0) ?: return Triple(-1.0, -1.0, -1.0)
    val uPlane = image.planes.getOrNull(1) ?: return Triple(-1.0, -1.0, -1.0)
    val vPlane = image.planes.getOrNull(2) ?: return Triple(-1.0, -1.0, -1.0)
    val w = image.width
    val h = image.height
    if (w <= 0 || h <= 0) return Triple(-1.0, -1.0, -1.0)

    val x0 = (w * 0.3).toInt()
    val x1 = (w * 0.7).toInt()
    val y0 = (h * 0.25).toInt()
    val y1 = (h * 0.75).toInt()
    val stepX = maxOf(1, (x1 - x0) / 32)
    val stepY = maxOf(1, (y1 - y0) / 32)

    val yBuf = yPlane.buffer
    val uBuf = uPlane.buffer
    val vBuf = vPlane.buffer
    var rs = 0.0
    var gs = 0.0
    var bs = 0.0
    var count = 0

    var y = y0
    while (y < y1) {
      var x = x0
      while (x < x1) {
        val yIdx = y * yPlane.rowStride + x * yPlane.pixelStride
        // Chroma is quarter-resolution on 4:2:0, hence the halved coordinates.
        val cIdx = (y / 2) * uPlane.rowStride + (x / 2) * uPlane.pixelStride
        val vIdx = (y / 2) * vPlane.rowStride + (x / 2) * vPlane.pixelStride
        if (yIdx < yBuf.limit() && cIdx < uBuf.limit() && vIdx < vBuf.limit()) {
          val luma = (yBuf.get(yIdx).toInt() and 0xFF).toDouble()
          val cb = (uBuf.get(cIdx).toInt() and 0xFF) - 128.0
          val cr = (vBuf.get(vIdx).toInt() and 0xFF) - 128.0
          rs += luma + 1.402 * cr
          gs += luma - 0.344136 * cb - 0.714136 * cr
          bs += luma + 1.772 * cb
          count++
        }
        x += stepX
      }
      y += stepY
    }

    if (count == 0) return Triple(-1.0, -1.0, -1.0)
    fun clamp(v: Double) = (v / count).coerceIn(0.0, 255.0)
    return Triple(clamp(rs), clamp(gs), clamp(bs))
  }

  /** Mean luma (0–255) sampled on a coarse ~64×48 grid from the Y plane. */
  private fun averageLuma(image: ImageProxy): Double {
    val plane = image.planes.getOrNull(0) ?: return 128.0
    val buffer = plane.buffer
    val rowStride = plane.rowStride
    val pixelStride = plane.pixelStride
    val w = image.width
    val h = image.height
    val stepX = maxOf(1, w / 64)
    val stepY = maxOf(1, h / 48)
    var sum = 0.0
    var count = 0
    var y = 0
    while (y < h) {
      val rowStart = y * rowStride
      var x = 0
      while (x < w) {
        val idx = rowStart + x * pixelStride
        if (idx < buffer.limit()) {
          sum += (buffer.get(idx).toInt() and 0xFF)
          count++
        }
        x += stepX
      }
      y += stepY
    }
    return if (count > 0) sum / count else 128.0
  }

  // "No face" sentinel — faceCount 0 (the worklet maps this to onNoFace), still
  // carrying the frame brightness so the low-light gate works pre-face.
  private fun noFace(brightness: Double) = FaceResult(
    headEulerAngleX = 0.0,
    headEulerAngleY = 0.0,
    headEulerAngleZ = 0.0,
    smilingProbability = 0.0,
    leftEyeOpenProbability = 1.0,
    rightEyeOpenProbability = 1.0,
    faceSizeRatio = 0.0,
    faceCount = 0.0,
    brightness = brightness,
    faceCenterX = -1.0,
    faceCenterY = -1.0,
    trackingId = -1.0,
    faceR = -1.0,
    faceG = -1.0,
    faceB = -1.0,
  )
}
