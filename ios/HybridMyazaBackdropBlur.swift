import NitroModules
import UIKit

// The blur around the face window of the full-screen liveness camera
// (src/specs/MyazaBackdropBlur.nitro.ts).
//
// A UIVisualEffectView blurs whatever is behind it, the camera preview
// included, every frame and on the GPU. The window is cut out of it with a
// MASK VIEW set on the effect view itself: that is the one way to shape a
// visual effect view. A mask on its layer, or on any view above it, switches
// the blur off.

final class HybridMyazaBackdropBlur: HybridMyazaBackdropBlurSpec {
  private let blur = BackdropBlurView()
  var view: UIView { blur }

  var windowX: Double = 0
  var windowY: Double = 0
  var windowWidth: Double = 0
  var windowHeight: Double = 0
  var dark: Bool = false

  // Props arrive as one batch; the view is told once, on the main thread.
  func afterUpdate() {
    let window = CGRect(x: windowX, y: windowY, width: windowWidth, height: windowHeight)
    let dark = self.dark
    let blur = self.blur
    if Thread.isMainThread {
      blur.update(window: window, dark: dark)
    } else {
      DispatchQueue.main.async { blur.update(window: window, dark: dark) }
    }
  }
}

final class BackdropBlurView: UIView {
  private let effectView = UIVisualEffectView(effect: nil)
  private var hole: CGRect = .zero
  private var dark: Bool?

  override init(frame: CGRect) {
    super.init(frame: frame)
    isUserInteractionEnabled = false
    backgroundColor = .clear
    addSubview(effectView)
  }

  required init?(coder: NSCoder) { nil }

  func update(window: CGRect, dark: Bool) {
    if self.dark != dark {
      self.dark = dark
      // The thinnest material: nearly all blur and very little colour of its
      // own. The flow lays its own tint over it. Named light or dark outright,
      // because the flow's theme is not always the phone's.
      effectView.effect = UIBlurEffect(
        style: dark ? .systemUltraThinMaterialDark : .systemUltraThinMaterialLight)
    }
    if hole != window {
      hole = window
      applyMask()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if effectView.frame != bounds {
      effectView.frame = bounds
      applyMask()
    }
  }

  /// Everything but the window. Built fresh each time: the effect view takes
  /// its own copy of the mask, so changing the old one's shape does nothing.
  private func applyMask() {
    guard bounds.width > 0, bounds.height > 0 else { return }
    let path = UIBezierPath(rect: bounds)
    let window = hole
    if window.width > 0, window.height >= window.width {
      // Round ends drawn as arcs: a rounded rect whose radius is half its
      // width does not come out as a true half circle.
      let r = window.width / 2
      let cut = UIBezierPath()
      cut.move(to: CGPoint(x: window.minX, y: window.minY + r))
      cut.addArc(
        withCenter: CGPoint(x: window.midX, y: window.minY + r), radius: r,
        startAngle: .pi, endAngle: 0, clockwise: true)
      cut.addLine(to: CGPoint(x: window.maxX, y: window.maxY - r))
      cut.addArc(
        withCenter: CGPoint(x: window.midX, y: window.maxY - r), radius: r,
        startAngle: 0, endAngle: .pi, clockwise: true)
      cut.close()
      path.append(cut)
    }
    let shape = CAShapeLayer()
    shape.frame = bounds
    shape.fillRule = .evenOdd
    shape.fillColor = UIColor.black.cgColor
    shape.path = path.cgPath
    let mask = UIView(frame: bounds)
    mask.backgroundColor = .clear
    mask.layer.addSublayer(shape)
    effectView.mask = mask
  }
}
