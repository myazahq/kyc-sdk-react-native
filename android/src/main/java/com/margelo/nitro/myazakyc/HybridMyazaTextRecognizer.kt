package com.margelo.nitro.myazakyc

import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageProxy
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Android half of on-device text recognition, implementing the nitrogen-generated
 * `HybridMyazaTextRecognizerSpec` from src/specs/MyazaTextRecognizer.nitro.ts.
 * The iOS half is HybridMyazaTextRecognizer.swift (Apple Vision).
 *
 * Used for reading the MRZ off a passport or ID card. Returns LINES only —
 * parsing lives in TypeScript, where it is testable against the ICAO specimen
 * without a device, and where the check digits do the actual deciding.
 *
 * Like the face detector, the Nitro worklet calls this synchronously, so ML
 * Kit's async recogniser is awaited on the worklet thread with a short bound.
 * Text recognition is heavier than face detection, hence the longer timeout —
 * but it still returns empty rather than stalling the camera pipeline.
 */
class HybridMyazaTextRecognizer : HybridMyazaTextRecognizerSpec() {
  private val recognizer: TextRecognizer =
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

  @ExperimentalGetImage
  override fun recognizeText(frame: HybridFrameSpec, bottomFraction: Double): TextResult {
    val proxy: ImageProxy = (frame as? NativeFrame)?.image ?: return TextResult(emptyArray())
    val mediaImage = proxy.image ?: return TextResult(emptyArray())

    val rotation = proxy.imageInfo.rotationDegrees
    val input = InputImage.fromMediaImage(mediaImage, rotation)

    // The upright frame height: when rotated 90/270 the stored dimensions swap.
    val uprightHeight = if (rotation == 90 || rotation == 270) mediaImage.width else mediaImage.height
    val fraction = bottomFraction.coerceIn(0.05, 1.0)
    // ML Kit has no region-of-interest, so the crop is applied to the RESULT:
    // anything whose box sits above the band is page text, not MRZ. That still
    // buys the important half of the benefit — the printed fields stop
    // competing with the MRZ for the extractor's attention.
    val cutoffY = uprightHeight * (1.0 - fraction)

    var lines: Array<String> = emptyArray()
    val latch = CountDownLatch(1)
    recognizer.process(input)
      .addOnSuccessListener { text ->
        lines = text.textBlocks
          .flatMap { it.lines }
          .filter { line ->
            val box = line.boundingBox
            // A line with no box cannot be placed, so it is kept rather than
            // dropped — the check digits will reject it if it is noise.
            box == null || fraction >= 1.0 || box.centerY() >= cutoffY
          }
          // Top to bottom: the MRZ's rows must arrive adjacent and in order for
          // the extractor's grouping to work.
          .sortedBy { it.boundingBox?.centerY() ?: 0 }
          .map { it.text }
          .toTypedArray()
        latch.countDown()
      }
      .addOnFailureListener { latch.countDown() }

    // 2s, not the 400ms this shipped with. ML Kit runs full-frame latin
    // recognition here (it has no ROI), which routinely takes longer than
    // 400ms on mid-tier hardware — so the await expired and returned EMPTY,
    // and auto-capture on Android almost never saw a single line of text.
    // The frame processor drops frames while busy, so a longer wait costs
    // fps, not a queue; an empty result costs the whole feature.
    latch.await(2000, TimeUnit.MILLISECONDS)
    return TextResult(lines)
  }

  override fun recognizeTextInImage(uri: String, bottomFraction: Double): Promise<TextResult> {
    return Promise.async {
      val ctx = NitroModules.applicationContext
        ?: return@async TextResult(emptyArray())
      // A still is already upright — unlike the live frame, which arrives
      // rotated by the camera pipeline and needs the rotation passed in.
      val input = runCatching { InputImage.fromFilePath(ctx, Uri.parse(uri)) }
        .getOrNull() ?: return@async TextResult(emptyArray())

      val fraction = bottomFraction.coerceIn(0.05, 1.0)
      val cutoffY = input.height * (1.0 - fraction)

      val latch = CountDownLatch(1)
      var lines: Array<String> = emptyArray()
      recognizer.process(input)
        .addOnSuccessListener { text ->
          lines = text.textBlocks
            .flatMap { it.lines }
            .filter { line ->
              val box = line.boundingBox
              box == null || fraction >= 1.0 || box.centerY() >= cutoffY
            }
            .sortedBy { it.boundingBox?.centerY() ?: 0 }
            .map { it.text }
            .toTypedArray()
          latch.countDown()
        }
        .addOnFailureListener { latch.countDown() }

      // A still can be large, so this is more generous than the per-frame path
      // — it runs once, off the camera thread, and the user is already waiting.
      latch.await(4, TimeUnit.SECONDS)
      TextResult(lines)
    }
  }
}
