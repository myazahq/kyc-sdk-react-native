import {
  lightingGuidanceText,
  positionGuidanceText,
  type useLiveness,
} from '../../liveness/useLiveness';

// ---------------------------------------------------------------------------
// Which single line the step shows, and in what tone.
//
// Ordered by severity: a warning the user must act on outranks the current
// instruction, so "move closer" is never buried under "nod your head".
// ---------------------------------------------------------------------------

export function resolveGuidance(l: ReturnType<typeof useLiveness>): { text: string; tone: 'normal' | 'error' } {
  if (l.multipleFaces) return { text: l.instruction, tone: 'error' };
  // Lighting is shown in its own banner (below), not as the main instruction.
  if (l.phase === 'positioning' && !l.faceDetected) {
    return { text: 'Position your face in the circle', tone: 'normal' };
  }
  if (l.positionGuidance) return { text: positionGuidanceText(l.positionGuidance), tone: 'error' };
  if (l.wrongGesture) return { text: 'Wrong gesture — follow the prompt', tone: 'error' };
  return { text: l.instruction, tone: 'normal' };
}

// Numbered progress steps with connectors — mirrors the web/Flutter SDKs:
// passed = solid green + checkmark, active = green-outlined number, pending =
// grey number. `active` marks the current (completed-th) step as in-progress.
