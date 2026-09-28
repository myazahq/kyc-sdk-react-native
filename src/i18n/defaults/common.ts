// Buttons shared by many screens.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const COMMON_TEXTS: Record<string, string> = {
  'common.continue': 'Continue',
  'common.continueAnyway': 'Continue anyway',
  'common.done': 'Done',
  'common.retake': 'Retake',
  'common.skip': 'Skip',
};

export const COMMON_NOT_SHOWN: Record<string, string> = {
  'common.back':
    'Back is an icon-only control in the sheet header with no visible text; as on web, its accessibility label is not customisable.',
};
