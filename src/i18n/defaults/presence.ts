// The selfie and liveness step.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const PRESENCE_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'presence.title': 'Face Verification',
  'presence.camera.description': 'Follow the on-screen instructions',

  // The instruction above the camera circle, also spoken (liveness/types.ts).
  'presence.position.placeFace': 'Position your face in the circle',
  'presence.challenge.nod': 'Kindly nod your head',
  'presence.challenge.turn': 'Kindly turn your head',
  'presence.challenge.blink': 'Blink your eyes',
  'presence.challenge.smile': 'Smile please',
  // Passive Liveness: the single hold prompt (liveness/types.ts HOLD_CHALLENGE).
  'presence.challenge.hold': 'Hold still and look at the camera',
};

export const PRESENCE_NOT_SHOWN: Record<string, string> = {
  'presence.intro.description':
    'The sheet header keeps the camera description on every liveness screen; the ready primer has its own copy, so there is no intro description.',
  'presence.review.title':
    'The selfie review shows the preview and its buttons under the step header, with no review title of its own.',
  'presence.review.description':
    'The selfie review shows the preview and its buttons under the step header, with no review description of its own.',
};
