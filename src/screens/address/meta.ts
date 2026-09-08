import type { KYCStep } from '../../types/config';

// ---------------------------------------------------------------------------
// The sheet header's title and description for each address step.
//
// The address screens do not draw their own headers — the sheet does, from
// here — so this is where their copy lives, beside the screens it describes.
// KYB says "premises" where the individual flow says "your building": the pin
// is the company's registered place of work, not somebody's home.
// ---------------------------------------------------------------------------

export function addressStepMeta(
  step: KYCStep,
  isBusiness: boolean,
  /** The entrance step is framing street imagery, which describes THAT, not a camera. */
  opts: { framing?: boolean } = {},
): { title: string; description: string } {
  switch (step) {
    case 'address-search':
      return {
        title: 'Find your address',
        description: 'Search it, use your current location, or place a pin on the map.',
      };
    case 'address-entrance':
      return {
        title: 'Show the entrance',
        description: opts.framing
          ? 'Frame your entrance in the street imagery. No camera needed.'
          : 'A picture of the gate or front door makes the address findable.',
      };
    case 'address-review':
      return {
        title: isBusiness ? 'Confirm the premises' : 'Confirm your address',
        description: 'Check everything is right before you continue.',
      };
    case 'address-collection':
    default:
      return {
        title: isBusiness ? 'Is the pin on the premises?' : 'Is the pin on your building?',
        description:
          'Drag the map until the pin sits exactly on it. You can add details for whoever needs to find it.',
      };
  }
}
