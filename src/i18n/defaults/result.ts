// The submitting, success and face check outcome screens.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const RESULT_TEXTS: Record<string, string> = {
  // The one loading screen after the capture (lib/result-copy.ts).
  'result.submitting.title': 'Submitting your verification',
  'result.submitting.description': 'Please wait a moment.',
  'result.faceCheck.checking.title': "Checking it's you",
  'result.faceCheck.checking.description':
    'Matching your selfie against the photo on record. This usually takes a few seconds.',
  'result.faceCheck.sending.title': 'Sending your face check',
  'result.faceCheck.sending.description': 'This only takes a moment.',
  'result.faceEnrolment.saving.title': 'Saving your selfie',
  'result.faceEnrolment.saving.description': 'It becomes the reference for your future face checks.',

  // The success screen (screens/SubmittedSuccess.tsx).
  'result.success.title': 'Verification Submitted!',
  'result.success.description.individual':
    "Your identity verification has been submitted for review. You'll be notified of the result.",
  'result.success.description.business':
    "Your business verification has been submitted for review. You'll be notified of the result.",

  // The face check verdicts (lib/result-copy.ts).
  'result.faceCheck.verified.title': "You're verified",
  'result.faceCheck.verified.description': 'Your face matched the photo on record.',
  'result.faceCheck.declined.title': "We couldn't confirm it's you",
  'result.faceCheck.declined.description': "Your face didn't match the photo on record.",
  'result.faceCheck.inReview.title': 'Under review',
  'result.faceCheck.inReview.description': "A reviewer will take a look. You'll be notified of the outcome.",
  'result.faceCheck.submitted.title': 'Check submitted',
  'result.faceCheck.submitted.description': "You'll be notified of the result.",
  'result.faceCheck.timeout.title': 'Still checking',
  'result.faceCheck.timeout.description': "This is taking longer than usual. You'll be notified as soon as it's done.",
};

const RETURNING =
  'Hosted pages only: the screen shown to an applicant who reopens a finished link. The app has no hosted link to reopen.';

export const RESULT_NOT_SHOWN: Record<string, string> = {
  'result.success.redirectLabel':
    'Hosted pages only: the button that follows the completion redirect. In the app Done hands back to the host.',
  'result.success.closeTabNote':
    'Hosted pages only: the note shown when a hosted page has no redirect. The app has no tab to close.',
  'result.completed.approved.title': RETURNING,
  'result.completed.approved.title.faceEnrolment': RETURNING,
  'result.completed.approved.description.individual': RETURNING,
  'result.completed.approved.description.business': RETURNING,
  'result.completed.approved.description.address': RETURNING,
  'result.completed.approved.description.faceEnrolment': RETURNING,
  'result.completed.approved.description.questionnaire': RETURNING,
  'result.completed.approved.description.contact': RETURNING,
  'result.completed.declined.title': RETURNING,
  'result.completed.declined.description.individual': RETURNING,
  'result.completed.declined.description.business': RETURNING,
  'result.completed.declined.description.address': RETURNING,
  'result.completed.declined.description.faceEnrolment': RETURNING,
  'result.completed.declined.description.questionnaire': RETURNING,
  'result.completed.declined.description.contact': RETURNING,
  'result.completed.actionNeeded.title': RETURNING,
  'result.completed.actionNeeded.description': RETURNING,
};
