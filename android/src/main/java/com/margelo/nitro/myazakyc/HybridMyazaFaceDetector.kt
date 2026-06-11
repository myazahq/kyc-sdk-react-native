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
    val mediaImage = proxy.image ?: return noFace(brightness)

    val rotation = proxy.imageInfo.rotationDegrees
    val input = InputImage.fromMediaImage(mediaImage, rotation)

    var result: FaceResult? = null
    val latch = CountDownLatch(1)
    detector.process(input)
      .addOnSuccessListener { faces ->
        val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
        result = face?.let { toResult(it, mediaImage.width, mediaImage.height, rotation, faces.size, brightness) }
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
  ): FaceResult {
    // After rotation the frame is upright; when rotated 90/270 the stored width/
    // height are swapped, so the smaller dimension is the upright "width".
    val frameWidth = if (rotation == 90 || rotation == 270) imageHeight else imageWidth
    val ratio = (face.boundingBox.width().toDouble() / frameWidth).coerceIn(0.0, 1.0)
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
    )
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
  )
}
