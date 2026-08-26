// ---------------------------------------------------------------------------
// How far a chip read has got.
//
// iOS puts a system sheet over the whole read and narrates it. Android has NO
// system NFC UI at all, so the same read is otherwise a bare spinner: the user
// cannot tell whether the chip has even been detected, let alone that three
// data groups are being pulled off it — and the natural response to that
// silence is to lift the document, which aborts the read.
//
// The wording is deliberately identical to the iOS sheet's, so both platforms
// narrate the read the same way. Ported from the Flutter SDK's NfcReadStage —
// keep the two in step.
// ---------------------------------------------------------------------------

export type NfcReadStage =
  /** Session open, waiting for the user to actually present the chip. */
  | 'waiting'
  /** Chip detected; opening the BAC session with the MRZ key. */
  | 'authenticating'
  /** Reading DG1 — the document's printed details. */
  | 'readingData'
  /** Reading EF.SOD — kilobytes, so the long one, and the step users abandon. */
  | 'readingSecurity'
  /** Reading DG2 — the chip's portrait. */
  | 'readingPhoto'
  /** Reading the optional detail groups (DG7/DG11/DG12) — small and quick. */
  | 'readingDetails'
  /** Everything that could be read has been. */
  | 'done';

/** Order of the read, used to decide which steps are already complete. */
export const NFC_STAGE_ORDER: NfcReadStage[] = [
  'waiting',
  'authenticating',
  'readingData',
  'readingSecurity',
  'readingPhoto',
  'readingDetails',
  'done',
];

/** Short label for the step list. */
export function nfcStageLabel(stage: NfcReadStage): string {
  switch (stage) {
    case 'waiting':
      return 'Waiting for the chip';
    case 'authenticating':
      return 'Unlocking the chip';
    case 'readingData':
      return 'Reading document details';
    case 'readingSecurity':
      return 'Reading security data';
    case 'readingPhoto':
      return 'Reading photo';
    case 'readingDetails':
      return 'Reading extra details';
    case 'done':
      return 'Chip read complete';
  }
}

/**
 * One line on what the phone is actually doing.
 *
 * A chip read is invisible — no shutter, no preview — so the detail is what
 * stops a pause reading as a failure and prompting the user to lift the
 * document.
 */
export function nfcStageDetail(stage: NfcReadStage): string {
  switch (stage) {
    case 'waiting':
      return 'Hold the top edge of your document flat against the back of your phone.';
    case 'authenticating':
      return 'Opening a secure session using the code printed on your photo page.';
    case 'readingData':
      return 'Copying the details stored on the chip.';
    case 'readingSecurity':
      return 'Downloading the chip’s digital signature. This is the largest part and takes the longest — keep holding.';
    case 'readingPhoto':
      return 'Copying the photo stored on the chip.';
    case 'readingDetails':
      return 'Copying the optional details stored on the chip. These are small and quick.';
    case 'done':
      return 'Everything was read successfully.';
  }
}

/**
 * The line shown on iOS's system NFC sheet while a stage runs.
 *
 * The sheet COVERS the app during the read, so this is the only narration an
 * iOS user gets. Terser than the in-app detail — the sheet truncates — and the
 * long transfers say "keep holding", because lifting during them is exactly
 * how the security file and the photo get lost.
 */
export function nfcSheetMessage(stage: NfcReadStage): string {
  switch (stage) {
    case 'waiting':
      return 'Hold your phone near the passport';
    case 'authenticating':
      return 'Chip found — unlocking it…';
    case 'readingData':
      return 'Reading document details…';
    case 'readingSecurity':
      return 'Verifying security data — keep holding…';
    case 'readingPhoto':
      return 'Reading your photo — keep holding…';
    case 'readingDetails':
      return 'Almost done — keep holding…';
    case 'done':
      return 'Chip read complete';
  }
}

/** Position in the read, 0..1 — drives the progress bar. */
export function nfcStageProgress(stage: NfcReadStage): number {
  switch (stage) {
    case 'waiting':
      return 0;
    case 'authenticating':
      return 0.15;
    case 'readingData':
      return 0.35;
    case 'readingSecurity':
      return 0.6;
    case 'readingPhoto':
      return 0.85;
    case 'readingDetails':
      return 0.95;
    case 'done':
      return 1;
  }
}
