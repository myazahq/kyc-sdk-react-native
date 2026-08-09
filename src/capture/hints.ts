import type { DocumentHint } from './documentIdentity';

// ---------------------------------------------------------------------------
// Capture hint copy.
//
// One instruction per rejection reason. Deliberately imperative and specific:
// a single message ("Align your ID within the frame") told the user nothing
// about WHICH way to move, and the commonest failure — holding the document
// too close — is the one people cannot guess, because the instinct on "it isn't
// reading" is to move nearer still.
//
// Copy is document-agnostic. `label` is the ID's own name so the same strings
// serve a passport, a card or a licence without special-casing any of them.
//
// Verbatim from the Flutter SDK's capture_hints.dart — keep the two identical.
// ---------------------------------------------------------------------------

export function documentHintText(hint: DocumentHint, label: string): string {
  switch (hint) {
    case 'searching':
      return `Point the camera at your ${label}`;
    case 'moreLight':
      return 'Too dark — move somewhere brighter';
    case 'wrongDocument':
      return `That doesn't look like a ${label}`;
    case 'showMrz':
      return 'Include the code strip along the bottom of the page';
    case 'moveCloser':
      return 'Move closer';
    case 'moveBack':
      // The one users don't reach for on their own.
      return `Move back a little — fit the whole ${label} in view`;
    case 'centre':
      return `Centre your ${label} in the frame`;
    case 'holdStill':
      return 'Hold still…';
    case 'captured':
      return 'Got it';
    default:
      return `Point the camera at your ${label}`;
  }
}

/**
 * True when the hint is asking the user to change something, so the UI can
 * give it more weight than the neutral prompts.
 */
export function documentHintIsAction(hint: DocumentHint): boolean {
  return (
    hint === 'moreLight' ||
    hint === 'wrongDocument' ||
    hint === 'showMrz' ||
    hint === 'moveCloser' ||
    hint === 'moveBack' ||
    hint === 'centre'
  );
}
