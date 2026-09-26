import { useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';

import type { ResolvedBusinessDocumentType } from '../config/businessSteps';
import { isAcceptedPoaMimeType, POA_ACCEPTED_MIME_TYPES } from '../config/proofOfAddress';
import { uploadSizeError } from '../config/uploadLimits';
import { loadDocumentPicker } from '../services/documentPicker';

// ---------------------------------------------------------------------------
// Getting a company document off the device — the business-documents step's
// twin of usePoaAttach (extracted from BusinessDocumentsStep, 200-line rule).
// Three sources, one shape handed to the step's uploader. Every pick is judged
// against the shared upload caps BEFORE anything is compressed or sent, so
// the refusal names the file that was chosen (images 5 MB, PDFs 15 MB).
// ---------------------------------------------------------------------------

/**
 * The minimum a slot must carry for this hook: it reads the label for error
 * copy and hands the slot straight back to the caller's uploader. Generalised
 * so the supporting-documents step shares this picker rather than owning a
 * second copy of three file sources and their size/MIME rules.
 */
export interface AttachableSlot {
  key: string;
  label: string;
}

export type AttachBusinessDocument<S extends AttachableSlot = ResolvedBusinessDocumentType> = (
  slot: S,
  uri: string,
  mimeType: string | undefined,
  name: string,
) => Promise<void>;

type Pick<S extends AttachableSlot> = (slot: S) => Promise<void>;

export function useBusinessDocumentAttach<S extends AttachableSlot = ResolvedBusinessDocumentType>(
  attach: AttachBusinessDocument<S>,
  setError: (message: string) => void,
): { takePhoto: Pick<S>; choosePhoto: Pick<S>; chooseFile: Pick<S> } {
  const tooLarge = useCallback(
    (mime: string | undefined, size: number | undefined): boolean => {
      const message = uploadSizeError(mime, size);
      if (message) setError(message);
      return message !== null;
    },
    [setError],
  );

  const takePhoto = useCallback<Pick<S>>(
    async (slot) => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera access is needed to photograph the document.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset || tooLarge(asset.mimeType, asset.fileSize)) return;
      // A FRIENDLY name, not the picker's temp junk — camera/library assets
      // carry generated names; the slot key says what the file IS.
      await attach(slot, asset.uri, asset.mimeType ?? 'image/jpeg', `${slot.key}.jpg`);
    },
    [attach, setError, tooLarge],
  );

  const choosePhoto = useCallback<Pick<S>>(
    async (slot) => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset || tooLarge(asset.mimeType, asset.fileSize)) return;
      await attach(slot, asset.uri, asset.mimeType ?? 'image/jpeg', `${slot.key}.jpg`);
    },
    [attach, tooLarge],
  );

  const chooseFile = useCallback<Pick<S>>(
    async (slot) => {
      const picker = loadDocumentPicker();
      if (!picker) {
        setError('Choosing a file is not available in this app. Please photograph the document.');
        return;
      }
      const result = await picker.getDocumentAsync({
        type: [...POA_ACCEPTED_MIME_TYPES],
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (!asset) return;
      // The picker's `type` filter is advisory on some platforms, so what came
      // back is re-checked rather than trusted.
      if (!isAcceptedPoaMimeType(asset.mimeType)) {
        setError('Please choose a PDF, JPG or PNG file.');
        return;
      }
      if (tooLarge(asset.mimeType, asset.size)) return;
      await attach(slot, asset.uri, asset.mimeType, asset.name ?? slot.key);
    },
    [attach, setError, tooLarge],
  );

  return { takePhoto, choosePhoto, chooseFile };
}
