import type { WorkflowTexts } from '../i18n/types';

/**
 * The custom-texts options, split from config.ts (200-line rule). Mirrors the
 * web SDK's `texts` and `language` props.
 */
export interface KYCTextsConfig {
  /**
   * Custom copy by language then key, e.g. `{ en: { 'common.continue': 'Next' } }`.
   * Usually set by a workflow (it rides `workflowId`). Only the customisable
   * keys are read; unset or blank texts keep the SDK default.
   */
  texts?: WorkflowTexts;

  /** The language texts are shown in (BCP-47, e.g. `en`, `fr`). Default `en`. */
  language?: string;
}
