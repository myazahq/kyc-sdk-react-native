// ---------------------------------------------------------------------------
// Custom texts: the types. Mirrors the web SDK's `i18n/types.ts`.
//
// A workflow's custom copy is keyed by language then text key. The keys are a
// shared contract with the web and Flutter SDKs (the vector file
// kyc-sdk-flutter/test/customisable_texts_vectors.json): the same key means the
// same place on every SDK, while each SDK keeps its own default wording.
// ---------------------------------------------------------------------------

/**
 * A workflow's custom copy: language (BCP-47, e.g. `en`, `fr`) to key to text.
 * Missing languages, keys and blank values all fall back to the default.
 */
export type WorkflowTexts = Record<string, Record<string, string>>;

/** Substitutions for `{name}` placeholders in a text. */
export type TextVars = Record<string, string | number | undefined | null>;

/**
 * Looks up a text by key, filling its placeholders. `legacy` is the value of
 * an older dedicated field (e.g. `consent.title`) that already held this text:
 * it wins over English custom copy and the default, but another language's own
 * text still wins in that language.
 */
export type TextFn = (key: string, vars?: TextVars, legacy?: string | null) => string;
