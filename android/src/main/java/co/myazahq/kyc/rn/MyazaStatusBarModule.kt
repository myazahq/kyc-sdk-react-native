package co.myazahq.kyc.rn

import android.content.Context
import android.util.Log
import android.view.WindowManager
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

  /**
   * Sets the screen brightness of the SDK modal's OWN window (the Dialog), for
   * the bright screen during liveness.
   *
   * A per-window override: no WRITE_SETTINGS permission, the system setting is
   * never touched, it stops applying when the app leaves the foreground, and it
   * dies with the modal. The activity window is deliberately never used as a
   * fallback: it is the host app's, and clearing an override there could undo
   * one the host set itself.
   *
   * @param viewTag    a React tag of a view rendered inside the modal.
   * @param brightness 0–1 to override, or any negative value to clear the
   *   override (the window follows the system brightness again).
   */
  @ReactMethod
  fun setWindowBrightness(viewTag: Double, brightness: Double) {
    val tag = viewTag.toInt()
    val ctx = reactApplicationContext
    UiThreadUtil.runOnUiThread {
      try {
        val view = UIManagerHelper.getUIManagerForReactTag(ctx, tag)?.resolveView(tag)
        val root = view?.rootView
        val params = root?.layoutParams as? WindowManager.LayoutParams
        if (root == null || params == null || !root.isAttachedToWindow) {
          // The modal is closing: its window, and the override with it, is gone.
          Log.w(TAG, "no attached window for tag=$tag; brightness left as is")
          return@runOnUiThread
        }
        params.screenBrightness =
          if (brightness < 0) WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
          else brightness.toFloat().coerceIn(0f, 1f)
        val wm = root.context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        wm.updateViewLayout(root, params)
      } catch (e: Exception) {
        Log.w(TAG, "setWindowBrightness($tag) failed: ${e.message}")
      }
    }
  }

  companion object {
    const val NAME = "MyazaStatusBarModule"
    private const val TAG = "MyazaStatusBar"
  }
}
