package com.margelo.nitro.myazakyc

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Path
import android.graphics.RectF
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.Shader
import android.os.Build
import android.view.View
import android.view.ViewGroup
import androidx.annotation.RequiresApi
import kotlin.math.ceil

/**
 * Draws the view BEHIND it again, blurred, everywhere but a round-ended window.
 *
 * "Behind" is the sibling added to the parent just before this view: the
 * camera. That sibling is recorded into a render node, the node is given a
 * blur, and it is drawn over the sibling with the window clipped out, so the
 * sharp camera shows through the window and its blurred twin covers the rest.
 *
 * The recording holds the sibling's children by reference, not by picture, so
 * it follows the camera frame by frame on the render thread with nothing
 * re-recorded here. That is also why the camera must be a TextureView: a
 * SurfaceView is drawn by the system behind the app's window and is not part
 * of anything a view can record.
 *
 * Android 12 (API 31) and later. Before that there is no blur a view can put
 * on live content at a usable cost, and this draws nothing; the screen lays a
 * plain tint instead.
 */
@SuppressLint("ViewConstructor")
internal class BackdropBlurView(context: Context) : View(context) {
  private val node: RenderNode? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) RenderNode("MyazaBackdropBlur") else null
  private val window = RectF()
  private val hole = Path()
  private val density = resources.displayMetrics.density
  private var target: View? = null
  private var marker: View? = null
  private var markerSearches = 0
  private var radiusApplied = -1f

  // The sibling moved or changed size: record it again.
  private val onTargetLayout =
    OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> invalidate() }

  init {
    setWillNotDraw(false)
  }

  // The window moved or changed size: cut the hole again.
  private val onMarkerLayout =
    OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> invalidate() }

  /**
   * Where the window is: the bounds of the MARKER, an empty view the screen
   * lays out exactly over the window, as a sibling of this one, named by its
   * nativeID.
   *
   * The window used to arrive as four number props. On Android they reached
   * this view as garbage (denormals: leftover register contents, not the
   * numbers sent), so the hole was never cut and the face was blurred with
   * everything else. A sibling's bounds come through ordinary layout, which
   * is always right, and need no second copy of the window's sizing rule.
   */
  private fun findMarker(): View? {
    marker?.let { return it }
    val parent = parent as? ViewGroup ?: return null
    for (i in 0 until parent.childCount) {
      val child = parent.getChildAt(i)
      if (child.getTag(com.facebook.react.R.id.view_tag_native_id) == MARKER_ID) {
        child.addOnLayoutChangeListener(onMarkerLayout)
        marker = child
        return child
      }
    }
    return null
  }

  private fun updateHole() {
    hole.rewind()
    val marker = findMarker()
    if (marker == null) {
      // Mounted a moment after this view. Look again for a few frames.
      if (markerSearches++ < MARKER_SEARCH_FRAMES) postInvalidateOnAnimation()
      return
    }
    window.set(
      (marker.left - left).toFloat(),
      (marker.top - top).toFloat(),
      (marker.right - left).toFloat(),
      (marker.bottom - top).toFloat(),
    )
    if (!window.isEmpty) {
      val r = window.width() / 2f
      hole.addRoundRect(window, r, r, Path.Direction.CW)
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    val parent = parent as? ViewGroup ?: return
    val index = parent.indexOfChild(this)
    target = if (index > 0) parent.getChildAt(index - 1) else null
    target?.addOnLayoutChangeListener(onTargetLayout)
    invalidate()
  }

  override fun onDetachedFromWindow() {
    target?.removeOnLayoutChangeListener(onTargetLayout)
    target = null
    marker?.removeOnLayoutChangeListener(onMarkerLayout)
    marker = null
    markerSearches = 0
    node?.discardDisplayList()
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    // A software canvas (a screenshot of the view tree, say) cannot draw a
    // render node. Nothing is drawn, and the camera shows through sharp.
    if (!canvas.isHardwareAccelerated) return
    drawBlurred(canvas)
  }

  @RequiresApi(Build.VERSION_CODES.S)
  private fun drawBlurred(canvas: Canvas) {
    val node = node ?: return
    val target = target ?: return
    if (width == 0 || height == 0) return

    // Recorded at a quarter of the size and drawn back up. A blur costs by
    // the pixel, and nothing is lost: it is about to be blurred anyway.
    val w = ceil(width / SCALE).toInt()
    val h = ceil(height / SCALE).toInt()
    node.setPosition(0, 0, w, h)
    val radius = RADIUS_DP * density / SCALE
    if (radius != radiusApplied) {
      // CLAMP repeats the edge pixels outward, so the screen's edges do not
      // darken the way they would if the blur read past them into nothing.
      node.setRenderEffect(RenderEffect.createBlurEffect(radius, radius, Shader.TileMode.CLAMP))
      radiusApplied = radius
    }
    val recording = node.beginRecording()
    try {
      recording.scale(1f / SCALE, 1f / SCALE)
      recording.translate((target.left - left).toFloat(), (target.top - top).toFloat())
      target.draw(recording)
    } finally {
      node.endRecording()
    }

    updateHole()
    val save = canvas.save()
    if (!hole.isEmpty) canvas.clipOutPath(hole)
    canvas.scale(SCALE, SCALE)
    canvas.drawRenderNode(node)
    canvas.restoreToCount(save)
  }

  private companion object {
    const val SCALE = 4f
    const val RADIUS_DP = 24f

    /** The nativeID of the view laid out over the window (components/BackdropBlur). */
    const val MARKER_ID = "myaza-blur-window"
    const val MARKER_SEARCH_FRAMES = 30
  }
}
