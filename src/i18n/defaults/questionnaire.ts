// The questionnaire step.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const QUESTIONNAIRE_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'questionnaire.title': 'A few more questions',
  'questionnaire.description': 'This information is required for compliance and helps keep your account safe.',

  // Fields (screens/QuestionnaireField.tsx, QuestionnaireBooleanField.tsx).
  'questionnaire.detailLabel': 'Please specify',
  'questionnaire.yes': 'Yes',
  'questionnaire.no': 'No',
};

export const QUESTIONNAIRE_NOT_SHOWN: Record<string, string> = {};
