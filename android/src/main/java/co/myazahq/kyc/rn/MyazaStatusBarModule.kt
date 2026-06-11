package co.myazahq.kyc.rn

import android.util.Log
import androidx.core.view.ViewCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper

/**
 * Themes the status/navigation-bar ICON appearance of the SDK modal's window.
 *
 * The SDK flow renders inside a React Native `<Modal>`, which runs in its own
 * native **Dialog window**. JS `StatusBar`/`SystemBars` only reach the **activity**
 * window, so they can't theme the modal's bars. A native **view-manager** can't
 * either — on the New Architecture, Fabric renders unregistered legacy view
 * managers as a blank "unimplemented view". Native **modules**, however, work fine
 * on Fabric, so this module resolves a view by tag (a view the SDK rendered INSIDE
 * the modal) and applies the bar appearance to THAT view's window — i.e. the Dialog.
 */
class MyazaStatusBarModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /**
   * @param viewTag a React tag of a view rendered inside the modal (its window is
   *   the modal Dialog).
   * @param light   true → light glyphs (dark background); false → dark glyphs.
   */
  @ReactMethod
  fun setBarStyle(viewTag: Double, light: Boolean) {
    val tag = viewTag.toInt()
    val ctx = reactApplicationContext
    UiThreadUtil.runOnUiThread {
      val view = try {
        UIManagerHelper.getUIManagerForReactTag(ctx, tag)?.resolveView(tag)
      } catch (e: Exception) {
        Log.w(TAG, "resolveView($tag) failed: ${e.message}")
        null
      } ?: ctx.currentActivity?.window?.decorView

      if (view == null) {
        Log.w(TAG, "no view/window to theme")
        return@runOnUiThread
      }

      val controller = ViewCompat.getWindowInsetsController(view)
      if (controller == null) {
        Log.w(TAG, "insets controller is null for tag=$tag")
        return@runOnUiThread
      }
      // isAppearanceLightStatusBars = true → dark glyphs; false → light glyphs.
      controller.isAppearanceLightStatusBars = !light
      controller.isAppearanceLightNavigationBars = !light
    }
  }

  companion object {
    const val NAME = "MyazaStatusBarModule"
    private const val TAG = "MyazaStatusBar"
  }
}
