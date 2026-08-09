import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import {
  isAcceptedPoaMimeType,
  POA_ACCEPTED_MIME_TYPES,
  POA_MAX_BYTES,
} from '../config/proofOfAddress';
import { loadDocumentPicker } from '../services/documentPicker';

// ---------------------------------------------------------------------------
// Getting a proof-of-address document off the device.
//
// One drop zone, like the web SDK — tapping it asks WHERE the document is
// coming from. Photographing a bill on the table and choosing a downloaded PDF
// are still different pickers, but they're a choice made after the user has
// committed to uploading, rather than two competing buttons that make the step
// look like it wants two files.
// ---------------------------------------------------------------------------

/** What the picker handed back, so the screen can preview it. */
export interface PoaPick {
  uri: string;
  mimeType: string | undefined;
  name: string;
}

type UploadFn = (pick: PoaPick) => Promise<void>;

export function usePoaAttach(
  upload: UploadFn,
  setError: (message: string) => void,
): {
  pick: () => void;
  sheetOpen: boolean;
  closeSheet: () => void;
  choosePhoto: () => Promise<void>;
  takePhoto: () => Promise<void>;
  chooseFile: () => Promise<void>;
} {
  const tooLarge = useCallback(
    (size: number | undefined): boolean => {
      if (typeof size === 'number' && size > POA_MAX_BYTES) {
        setError('File is too large (max 20MB).');
        return true;
      }
      return false;
    },
    [setError],
  );

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to photograph the document.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    if (tooLarge(asset.fileSize)) return;
    await upload({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      name: asset.fileName ?? 'proof-of-address.jpg',
    });
  }, [setError, tooLarge, upload]);

  const choosePhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    if (tooLarge(asset.fileSize)) return;
    await upload({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      name: asset.fileName ?? 'proof-of-address.jpg',
    });
  }, [tooLarge, upload]);

  const chooseFile = useCallback(async () => {
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
      setError('Please choose a photo (JPEG, PNG or WebP) or a PDF.');
      return;
    }
    if (tooLarge(asset.size)) return;
    await upload({
      uri: asset.uri,
      mimeType: asset.mimeType,
      name: asset.name ?? 'proof-of-address',
    });
  }, [setError, tooLarge, upload]);

  // The "where is it?" question is the SDK's own sheet now, not
  // ActionSheetIOS / Alert — both were stock OS dialogs dropped into the
  // middle of a branded flow (and the Android alert didn't even read as a
  // chooser). The hook only owns the STATE; the screen renders the
  // MediaSourceSheet, because a hook can't render.
  const [sheetOpen, setSheetOpen] = useState(false);
  const pick = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return { pick, sheetOpen, closeSheet, choosePhoto, takePhoto, chooseFile };
}
