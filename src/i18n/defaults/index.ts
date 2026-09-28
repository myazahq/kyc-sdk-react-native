import { WELCOME_TEXTS, WELCOME_NOT_SHOWN } from './welcome';
import { CONTACT_TEXTS, CONTACT_NOT_SHOWN } from './contact';
import { SELECT_DOCUMENT_TEXTS, SELECT_DOCUMENT_NOT_SHOWN } from './selectDocument';
import { PRIMER_TEXTS, PRIMER_NOT_SHOWN } from './primer';
import { UPLOAD_DOCUMENT_TEXTS, UPLOAD_DOCUMENT_NOT_SHOWN } from './uploadDocument';
import { NFC_TEXTS, NFC_NOT_SHOWN } from './nfc';
import { PRESENCE_TEXTS, PRESENCE_NOT_SHOWN } from './presence';
import { ADDRESS_INTRO_TEXTS, ADDRESS_INTRO_NOT_SHOWN } from './address-intro';
import { ADDRESS_PIN_TEXTS, ADDRESS_PIN_NOT_SHOWN } from './address-pin';
import { ADDRESS_FINISH_TEXTS, ADDRESS_FINISH_NOT_SHOWN } from './address-finish';
import { PROOF_OF_ADDRESS_TEXTS, PROOF_OF_ADDRESS_NOT_SHOWN } from './proofOfAddress';
import { SUPPORTING_DOCUMENTS_TEXTS, SUPPORTING_DOCUMENTS_NOT_SHOWN } from './supportingDocuments';
import { BUSINESS_TEXTS, BUSINESS_NOT_SHOWN } from './business';
import { KEY_PEOPLE_TEXTS, KEY_PEOPLE_NOT_SHOWN } from './keyPeople';
import { QUESTIONNAIRE_TEXTS, QUESTIONNAIRE_NOT_SHOWN } from './questionnaire';
import { RESULT_TEXTS, RESULT_NOT_SHOWN } from './result';
import { HANDOFF_TEXTS, HANDOFF_NOT_SHOWN } from './handoff';
import { COMMON_TEXTS, COMMON_NOT_SHOWN } from './common';

// ---------------------------------------------------------------------------
// Every customisable key this SDK shows, with its default, and every one it
// has no place for, with the reason. One file per group (200-line rule).
// ---------------------------------------------------------------------------

/** Key to this SDK's own default wording, for every customisable key it shows. */
export const DEFAULT_TEXTS: Readonly<Record<string, string>> = {
  ...WELCOME_TEXTS,
  ...CONTACT_TEXTS,
  ...SELECT_DOCUMENT_TEXTS,
  ...PRIMER_TEXTS,
  ...UPLOAD_DOCUMENT_TEXTS,
  ...NFC_TEXTS,
  ...PRESENCE_TEXTS,
  ...ADDRESS_INTRO_TEXTS,
  ...ADDRESS_PIN_TEXTS,
  ...ADDRESS_FINISH_TEXTS,
  ...PROOF_OF_ADDRESS_TEXTS,
  ...SUPPORTING_DOCUMENTS_TEXTS,
  ...BUSINESS_TEXTS,
  ...KEY_PEOPLE_TEXTS,
  ...QUESTIONNAIRE_TEXTS,
  ...RESULT_TEXTS,
  ...HANDOFF_TEXTS,
  ...COMMON_TEXTS,
};

/** Key to why this SDK has no place to show it. */
export const NOT_SHOWN: Readonly<Record<string, string>> = {
  ...WELCOME_NOT_SHOWN,
  ...CONTACT_NOT_SHOWN,
  ...SELECT_DOCUMENT_NOT_SHOWN,
  ...PRIMER_NOT_SHOWN,
  ...UPLOAD_DOCUMENT_NOT_SHOWN,
  ...NFC_NOT_SHOWN,
  ...PRESENCE_NOT_SHOWN,
  ...ADDRESS_INTRO_NOT_SHOWN,
  ...ADDRESS_PIN_NOT_SHOWN,
  ...ADDRESS_FINISH_NOT_SHOWN,
  ...PROOF_OF_ADDRESS_NOT_SHOWN,
  ...SUPPORTING_DOCUMENTS_NOT_SHOWN,
  ...BUSINESS_NOT_SHOWN,
  ...KEY_PEOPLE_NOT_SHOWN,
  ...QUESTIONNAIRE_NOT_SHOWN,
  ...RESULT_NOT_SHOWN,
  ...HANDOFF_NOT_SHOWN,
  ...COMMON_NOT_SHOWN,
};
