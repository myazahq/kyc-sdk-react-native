/**
 * The line under "Supporting documents", from what the flow is actually
 * asking for.
 *
 * It used to be one sentence about keeping documents on file plus a note that
 * required ones are marked with an asterisk — which tells somebody how to read
 * the screen rather than what is being asked of them, and the asterisk carries
 * no information at all when every document is required. The counts are what
 * a person wants: how many they have to produce before they can go on.
 *
 * MIRRORS the web SDK's supportingDocumentsIntro. Keep the wording in step.
 */
export function supportingDocumentsIntro(
  slots: ReadonlyArray<{ required: boolean }>,
): string {
  const total = slots.length;
  const required = slots.filter((slot) => slot.required).length;

  // Nothing is compulsory, so the honest line is that the step can be skipped.
  if (required === 0) {
    return total === 1
      ? 'Upload this document if you have it, so we can keep it on file. You can skip it.'
      : 'Upload any of these you have, so we can keep them on file. You can skip the rest.';
  }

  if (required === total) {
    return total === 1
      ? 'We need this document to continue. Upload it below.'
      : `We need all ${total} of these documents to continue. Upload one for each item below.`;
  }

  // Mixed, and the only case where the asterisk earns its place on the screen.
  // The noun agrees with the TOTAL, which is always two or more here.
  return `We need ${required} of these ${total} documents to continue, marked with *. Upload the others if you have them.`;
}
