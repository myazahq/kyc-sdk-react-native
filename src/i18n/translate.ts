import { DEFAULT_TEXTS } from './defaults';
import { CUSTOMISABLE_KEYS } from './customisable';
import type { TextFn, TextVars, WorkflowTexts } from './types';

// ---------------------------------------------------------------------------
// The text resolver. Mirrors the web SDK's `i18n/translate.ts` exactly: the
// same order, the same blank-is-unset rule, the same placeholder filling, so a
// workflow's copy reads the same on every SDK.
// ---------------------------------------------------------------------------

/** The language every workflow falls back to. */
export const BASE_LANGUAGE = 'en';

/** Fills `{name}` placeholders; a missing value becomes '' so no brace leaks to the screen. */
export function fillPlaceholders(template: string, vars: TextVars = {}): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (match, name: string) => {
    if (!(name in vars)) return match;
    const value = vars[name];
    return value === undefined || value === null ? '' : String(value);
  });
}

const usable = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

/**
 * The text for a key, in this order: the workflow's copy in the applicant's
 * language (when that is not English), the older dedicated field (`legacy`),
 * the workflow's English copy, the SDK default. Workflow copy counts only for a
 * customisable key. A blank value counts as unset, so clearing a field in the
 * editor restores the default rather than showing nothing.
 */
export function resolveText(
  key: string,
  options: { texts?: WorkflowTexts; language?: string; vars?: TextVars; legacy?: string | null } = {},
): string {
  const { texts, language = BASE_LANGUAGE, vars } = options;
  // Only the customisable texts take a workflow's words; everything else
  // always reads as the SDK wrote it.
  const pick = (lang: string): string | undefined =>
    CUSTOMISABLE_KEYS.has(key) ? usable(texts?.[lang]?.[key]) : undefined;
  const own = language === BASE_LANGUAGE ? undefined : pick(language);
  const template = own ?? usable(options.legacy) ?? pick(BASE_LANGUAGE) ?? DEFAULT_TEXTS[key] ?? key;
  return fillPlaceholders(template, vars).replace(/[ \t]{2,}/g, ' ').trim();
}

/** A `t()` bound to one workflow's texts, language and fixed variables. */
export function createTextFn(texts?: WorkflowTexts, language?: string, baseVars: TextVars = {}): TextFn {
  return (key, vars, legacy) => resolveText(key, { texts, language, legacy, vars: { ...baseVars, ...vars } });
}

/** The defaults only: for pure copy helpers called without a workflow. */
export const defaultText: TextFn = createTextFn();
