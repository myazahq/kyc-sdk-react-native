import NitroModules
import UIKit

// A view that keeps a finger's drag for React Native
// (src/specs/MyazaTouchGuard.nitro.ts).
//
// Two things, because either alone has a gap:
//
//   1. UIKit asks the touched view whether a recogniser may begin. Answering
//      no to pans stops the scroll view and the sheet from taking the drag.
//   2. A recogniser that is already tracking the touch is dropped by switching
//      it off and on again, which cancels it for this touch only.
//
// React Native's own touch handler is not a pan recogniser, so it is left
// alone and the control underneath still gets every move.

final class HybridMyazaTouchGuard: HybridMyazaTouchGuardSpec {
  private let guardView = TouchGuardView()
  var view: UIView { guardView }

  var guarding: Bool = true

  func afterUpdate() {
    let guarding = self.guarding
    let guardView = self.guardView
    if Thread.isMainThread {
      guardView.guarding = guarding
    } else {
      DispatchQueue.main.async { guardView.guarding = guarding }
    }
  }
}

final class TouchGuardView: UIView {
  var guarding = true

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .clear
    isMultipleTouchEnabled = false
  }

  required init?(coder: NSCoder) { nil }

  override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    if guarding, gestureRecognizer is UIPanGestureRecognizer { return false }
    return super.gestureRecognizerShouldBegin(gestureRecognizer)
  }

  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
    if guarding { dropAncestorPans() }
    super.touchesBegan(touches, with: event)
  }

  /// Every pan recogniser above this view (the scroll view's, the sheet's)
  /// gives up the touch that has just begun.
  private func dropAncestorPans() {
    var ancestor = superview
    while let current = ancestor {
      for recognizer in current.gestureRecognizers ?? []
      where recognizer is UIPanGestureRecognizer && recognizer.isEnabled {
        recognizer.isEnabled = false
        recognizer.isEnabled = true
      }
      ancestor = current.superview
    }
  }
}
