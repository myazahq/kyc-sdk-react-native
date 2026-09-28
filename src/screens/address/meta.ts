import type { KYCStep } from '../../types/config';
import { defaultText } from '../../i18n/translate';
import type { TextFn } from '../../i18n/types';

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
  t: TextFn = defaultText,
): { title: string; description: string } {
  switch (step) {
    case 'address-search':
      return {
        title: t('address.search.title'),
        description: t('address.search.description'),
      };
    case 'address-entrance':
      return {
        title: t('address.entrance.title'),
        description: opts.framing
          ? t('address.entrance.description.framing')
          : t('address.entrance.description.photo'),
      };
    case 'address-review':
      return {
        title: isBusiness ? t('address.review.title.business') : t('address.review.title'),
        description: t('address.review.description'),
      };
    case 'address-collection':
    default:
      return {
        title: isBusiness ? t('address.pin.title.business') : t('address.pin.title'),
        description: t('address.pin.description'),
      };
  }
}
