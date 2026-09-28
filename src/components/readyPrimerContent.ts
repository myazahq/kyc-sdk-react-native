import type { IconName } from './Icon';

// ---------------------------------------------------------------------------
// "Here's what happens next" copy.
//
// A port of the Flutter SDK's ready_primer_content.dart and the web SDK's
// ready-primer-content.ts. Kept as data in ONE place per platform so the
// document and liveness screens cannot drift from each other, and so the three
// SDKs can be diffed string-for-string.
//
// Any change here must be mirrored in the other two — someone who starts on the
// hosted web flow and finishes in a native app should read the same words.
// ---------------------------------------------------------------------------

export interface ReadyChecklistItem {
  icon: IconName;
  label: string;
}

export interface ReadyContent {
  icon: IconName;
  title: string;
  body: string;
  /** What to expect. Three at most; past that nobody reads it. */
  checklist: ReadyChecklistItem[];
  /**
   * The catalogue entries (`primer.*`) ReadyPrimer shows in place of the
   * English above, so a workflow's copy reaches every screen that uses this.
   */
  textKeys?: { title: string; body: string; checklist: string[] };
}

export const READY_DOCUMENT: ReadyContent = {
  icon: 'scan-line',
  title: "You're about to scan your ID",
  body:
    "We'll photograph your document and read it automatically. " +
    'Nothing is shared until you submit.',
  checklist: [
    { icon: 'id-card', label: 'Have your physical document with you' },
    { icon: 'sun', label: 'Find even lighting, avoid glare' },
    { icon: 'timer', label: 'Takes about a minute' },
  ],
  textKeys: {
    title: 'primer.document.title',
    body: 'primer.document.body',
    checklist: ['primer.document.checklist1', 'primer.document.checklist2', 'primer.document.checklist3'],
  },
};

export const READY_LIVENESS: ReadyContent = {
  icon: 'scan-face',
  title: "Let's confirm you're really here",
  body:
    "You'll follow a few short prompts on screen. This proves a real person " +
    'is present, not a photo or a recording.',
  checklist: [
    { icon: 'user', label: 'Put your face in the circle' },
    { icon: 'glasses', label: 'Take off glasses or anything covering your face' },
    { icon: 'sun', label: 'Choose a bright spot, with the light in front of you' },
    { icon: 'sparkles', label: 'Keep glare and shiny reflections off your face' },
  ],
  textKeys: {
    title: 'primer.selfie.title',
    body: 'primer.selfie.body',
    checklist: ['primer.selfie.checklist1', 'primer.selfie.checklist2', 'primer.selfie.checklist4', 'primer.selfie.checklist5'],
  },
};

/** Passive Liveness asks for no prompts, so its description says so. */
export const READY_LIVENESS_PASSIVE: ReadyContent = {
  ...READY_LIVENESS,
  body:
    "You'll hold still and look at the camera for a moment. This proves a real " +
    'person is present, not a photo or a recording.',
  textKeys: { ...READY_LIVENESS.textKeys!, body: 'primer.selfie.bodyPassive' },
};
