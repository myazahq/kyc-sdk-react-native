package com.margelo.nitro.myazakyc

import android.view.View
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext

/**
 * The blur around the face window of the full-screen liveness camera
 * (src/specs/MyazaBackdropBlur.nitro.ts). The drawing is in [BackdropBlurView].
 */
@Keep
@DoNotStrip
class HybridMyazaBackdropBlur(context: ThemedReactContext) : HybridMyazaBackdropBlurSpec() {
  private val blur = BackdropBlurView(context)
  override val view: View get() = blur

  // The window props are iOS's. Here they arrive as garbage, so the view reads
  // the window from a marker view laid out over it (see BackdropBlurView).
  override var windowX: Double = 0.0
  override var windowY: Double = 0.0
  override var windowWidth: Double = 0.0
  override var windowHeight: Double = 0.0

  // The material's shade is iOS's; here the blur has no colour of its own.
  override var dark: Boolean = false
}
