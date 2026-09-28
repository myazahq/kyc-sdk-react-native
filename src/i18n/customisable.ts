import { DEFAULT_TEXTS } from './defaults';
import { NOT_SHOWN } from './not-shown';

// ---------------------------------------------------------------------------
// The keys a workflow may change. The set is the shared contract
// (kyc-sdk-flutter/test/customisable_texts_vectors.json, pinned by
// customisableTexts.test.ts), split two ways:
//
//   • DEFAULT_TEXTS: the keys this SDK shows, each with ITS OWN default (the
//     wording the screen had before the key existed);
//   • NOT_SHOWN: the keys naming a place this SDK has no screen for, with why.
//
// Everything else the SDK says (errors, system and status lines, input
// placeholders, the legal notice) keeps its own wording and is not listed.
// ---------------------------------------------------------------------------

export const CUSTOMISABLE_KEYS: ReadonlySet<string> = new Set([
  ...Object.keys(DEFAULT_TEXTS),
  ...Object.keys(NOT_SHOWN),
]);
