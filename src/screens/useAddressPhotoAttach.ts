import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { isAcceptedAddressPhotoMimeType } from '../config/addressCollection';
import { IMAGE_MAX_BYTES } from '../config/uploadLimits';

// ---------------------------------------------------------------------------
// Getting the door photo off the device — the address step's slim sibling of
// usePoaAttach. Camera or photo library only: the door photo is a PICTURE of a
// place, so there is no PDF/file case, and each pick closes the source sheet
// before the picker opens.
// ---------------------------------------------------------------------------

/** What the picker handed back, so the screen can preview it. */
export interface AddressPhotoPick {
  uri: string;
  mimeType: string | undefined;
  name: string;
}

type UploadFn = (pick: AddressPhotoPick) => Promise<void>;

export function useAddressPhotoAttach(
  upload: UploadFn,
  setError: (message: string) => void,
): {
  pick: () => void;
  sheetOpen: boolean;
  closeSheet: () => void;
  choosePhoto: () => Promise<void>;
  takePhoto: () => Promise<void>;
} {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pick = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const accept = useCallback(
    async (asset: ImagePicker.ImagePickerAsset | undefined, fallbackName: string) => {
      if (!asset) return;
      if (typeof asset.fileSize === 'number' && asset.fileSize > IMAGE_MAX_BYTES) {
        setError('Photo is too large (max 5 MB).');
        return;
      }
      const mimeType = asset.mimeType ?? 'image/jpeg';
      // The picker's media filter is advisory on some platforms, so what came
      // back is re-checked rather than trusted.
      if (!isAcceptedAddressPhotoMimeType(mimeType)) {
        setError('Please choose a photo (JPEG, PNG or WebP).');
        return;
      }
      await upload({ uri: asset.uri, mimeType, name: asset.fileName ?? fallbackName });
    },
    [setError, upload],
  );

  const takePhoto = useCallback(async () => {
    setSheetOpen(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to photograph the entrance.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    await accept(result.canceled ? undefined : result.assets[0], 'address-photo.jpg');
  }, [accept, setError]);

  const choosePhoto = useCallback(async () => {
    setSheetOpen(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    await accept(result.canceled ? undefined : result.assets[0], 'address-photo.jpg');
  }, [accept]);

  return { pick, sheetOpen, closeSheet, choosePhoto, takePhoto };
}
