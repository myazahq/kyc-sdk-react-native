import { defaultText } from '../i18n/translate';
import type { TextFn } from '../i18n/types';
import type { DocumentCapturePhase } from '../store/state';
import { supportingDocumentsIntro } from '../lib/supportingDocumentsIntro';

// ---------------------------------------------------------------------------
// The sheet header's words for the steps whose header is fixed copy. The
// screens do not draw their own headers (the sheet does, via stepHeaderMeta),
// so each title and description is a customisable text read through `t`.
// Moved here from the screens (200-line rule); pure, no React Native.
// ---------------------------------------------------------------------------

export interface HeaderCopy {
  title: string;
  description: string;
}

export const countrySelectMeta = (t: TextFn = defaultText): HeaderCopy => ({
  title: t('selectDocument.country.title'),
  description: t('selectDocument.country.description'),
});

export const businessDetailsMeta = (t: TextFn = defaultText): HeaderCopy => ({
  title: t('business.details.title'),
  description: t('business.details.description'),
});

export const businessKeyPeopleMeta = (t: TextFn = defaultText): HeaderCopy => ({
  title: t('keyPeople.title'),
  description: t('keyPeople.description'),
});

export const businessDocumentsMeta = (t: TextFn = defaultText): HeaderCopy => ({
  title: t('business.documents.title'),
  description: t('business.documents.description'),
});

export const applicantRoleMeta = (t: TextFn = defaultText): HeaderCopy => ({
  title: t('business.applicant.title'),
  description: t('business.applicant.description'),
});

export const nfcMeta = (t: TextFn = defaultText): HeaderCopy => ({
  title: t('nfc.title'),
  description: t('nfc.description'),
});

/** The line under the title counts what the flow actually asks for. */
export const supportingDocumentsMeta = (
  slots: ReadonlyArray<{ required: boolean }>,
  t: TextFn = defaultText,
): HeaderCopy => ({
  title: t('supportingDocuments.title'),
  description: supportingDocumentsIntro(slots, t),
});

/** The questionnaire's older `title` / `description` fields win, as on web. */
export function questionnaireMeta(
  title: string | undefined,
  description: string | undefined,
  t: TextFn = defaultText,
): HeaderCopy {
  return {
    title: t('questionnaire.title', undefined, title),
    description: t('questionnaire.description', undefined, description),
  };
}

export function proofOfAddressMeta(
  maxAgeDays: number,
  /** Whether the workflow's name rule wants the applicant's name on THIS
   *  document. False for e.g. a Nigerian utility bill that names the meter,
   *  not the tenant — asking for "your name" there sends people hunting for a
   *  document they do not have. */
  nameNeeded = true,
  t: TextFn = defaultText,
): HeaderCopy {
  return {
    title: t('proofOfAddress.title'),
    description: `Upload a document that shows your ${nameNeeded ? 'name and home address' : 'home address'}, issued within the last ${maxAgeDays} days.`,
  };
}

/**
 * A document-capture phase's header. An upload-only workflow asks for a photo,
 * so it cannot say "scan". The review phase reads the same in both modes.
 */
export function documentCaptureMeta(
  phase: DocumentCapturePhase,
  documentLabel: string,
  mode: 'scan' | 'upload' = 'scan',
  t: TextFn = defaultText,
  twoSided = false,
): HeaderCopy {
  const document = { document: documentLabel };
  const upload = mode === 'upload';
  // A two-sided document's front and review have texts of their own, as on web.
  switch (phase) {
    case 'front':
      if (twoSided) {
        return upload
          ? { title: t('uploadDocument.title.uploadFront', document), description: t('uploadDocument.description.uploadFront', document) }
          : { title: t('uploadDocument.title.scanFront', document), description: t('uploadDocument.description.scanFront', document) };
      }
      return upload
        ? { title: t('uploadDocument.title.upload', document), description: t('uploadDocument.description.upload', document) }
        : { title: t('uploadDocument.title.capture', document), description: t('uploadDocument.description.capture', document) };
    case 'front-preview':
      return upload
        ? { title: t('uploadDocument.title.frontAdded'), description: t('uploadDocument.description.frontAdded') }
        : { title: t('uploadDocument.title.frontCaptured'), description: t('uploadDocument.description.frontCaptured') };
    case 'back':
      return upload
        ? { title: t('uploadDocument.title.uploadBack', document), description: t('uploadDocument.description.uploadBack', document) }
        : { title: t('uploadDocument.title.scanBack', document), description: t('uploadDocument.description.scanBack', document) };
    case 'review':
    default: {
      const description = !twoSided
        ? t('uploadDocument.description.review')
        : upload
          ? t('uploadDocument.description.reviewBothAdded')
          : t('uploadDocument.description.reviewBoth');
      return { title: t('uploadDocument.title.review', document), description };
    }
  }
}
