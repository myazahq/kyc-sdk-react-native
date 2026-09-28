// The "get ready" primers and the camera permission screen.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const PRIMER_TEXTS: Record<string, string> = {
  // Before the document camera (components/readyPrimerContent.ts READY_DOCUMENT).
  'primer.document.title': "You're about to scan your ID",
  'primer.document.body': "We'll photograph your document and read it automatically. Nothing is shared until you submit.",
  'primer.document.checklist1': 'Have your physical document with you',
  'primer.document.checklist2': 'Find even lighting, avoid glare',
  'primer.document.checklist3': 'Takes about a minute',
  // Before the selfie camera (READY_LIVENESS, shown by the liveness step).
  'primer.selfie.title': "Let's confirm you're really here",
  'primer.selfie.body':
    "You'll follow a few short prompts on screen. This proves a real person is present, not a photo or a recording.",
  // The same primer when the workflow uses Passive Liveness (READY_LIVENESS_PASSIVE).
  'primer.selfie.bodyPassive':
    "You'll hold still and look at the camera for a moment. This proves a real person is present, not a photo or a recording.",
  'primer.selfie.checklist1': 'Put your face in the circle',
  'primer.selfie.checklist2': 'Take off glasses or anything covering your face',
  'primer.selfie.checklist4': 'Choose a bright spot, with the light in front of you',
  'primer.selfie.checklist5': 'Keep glare and shiny reflections off your face',
  // components/ReadyPrimer.tsx.
  'primer.readyButton': "I'm ready",
  // components/CameraPermissionView.tsx CameraPermissionPrimingView (both
  // camera steps); the document step passes the document body.
  'primer.camera.title': 'Allow camera access',
  'primer.camera.body': 'When prompted, allow camera access to continue your verification.',
  'primer.camera.bodyDocument': 'When prompted, allow camera access to photograph your document.',
  'primer.camera.button': 'Grant access',
};

export const PRIMER_NOT_SHOWN: Record<string, string> = {};
