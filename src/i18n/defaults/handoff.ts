// Continuing on another device.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const HANDOFF_TEXTS: Record<string, string> = {};

const NO_HANDOFF =
  'The app already runs on the phone, so there is no desktop-to-phone handoff gate or sheet to show this on.';

export const HANDOFF_NOT_SHOWN: Record<string, string> = {
  'handoff.gate.title': NO_HANDOFF,
  'handoff.gate.description': NO_HANDOFF,
  'handoff.gate.description.noCamera': NO_HANDOFF,
  'handoff.gate.description.mobileOnly': NO_HANDOFF,
  'handoff.codeLabel': NO_HANDOFF,
  'handoff.copyLink': NO_HANDOFF,
  'handoff.continueHere': NO_HANDOFF,
  'handoff.mobileOnly.title': NO_HANDOFF,
  'handoff.mobileOnly.description': NO_HANDOFF,
  'handoff.completed.title': NO_HANDOFF,
  'handoff.completed.description': NO_HANDOFF,
  'handoff.sheet.trigger': NO_HANDOFF,
  'handoff.sheet.title': NO_HANDOFF,
  'handoff.sheet.description': NO_HANDOFF,
  'handoff.sheet.stayButton': NO_HANDOFF,
};
