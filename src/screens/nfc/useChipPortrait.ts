import { useEffect, useState } from 'react';

import { decodeChipImage } from '../../emrtd';
import { extractChipPortrait } from '../../emrtd/dg2';

// ---------------------------------------------------------------------------
// The chip's own portrait, made renderable.
//
// Seeing the photo the issuing government stored on the chip is a far stronger
// confirmation than a tick — it is the one moment the user can check the
// document against itself.
//
// Most passports store DG2 as JPEG 2000, which React Native cannot display. The
// portrait was therefore being read, hash-verified against the signed security
// object, and then discarded unshown on the majority of documents. The platform
// has a decoder (ImageIO on iOS, BitmapFactory on Android), so the JP2 case is
// handed to it and comes back as JPEG.
//
// Best-effort throughout: a portrait that cannot be decoded yields null and the
// panel falls back to its generic mark. The chip read's verdict never depends
// on whether the picture could be drawn.
// ---------------------------------------------------------------------------

export function useChipPortrait(dg2: string | undefined): string | null {
  // JPEG needs no help — use it immediately rather than waiting a frame on a
  // native round trip that has nothing to do.
  const direct = extractChipPortrait(dg2);
  const [decoded, setDecoded] = useState<string | null>(null);

  useEffect(() => {
    // Four ways to end up with no picture, and they need different fixes: the
    // chip never gave up DG2 (SOD failed, so it was never requested — or the
    // document lifted during the photo read, the longest transfer), DG2
    // arrived in a format we did not recognise, the platform declined to
    // decode it, or a direct-JPEG slice that does not actually render. Logged
    // on EVERY path — the direct-JPEG case used to be silent, which made "no
    // photo" undiagnosable from the field.
    if (__DEV__) {
      console.log('[myaza] chip portrait:', {
        dg2Bytes: dg2 ? dg2.length : 0,
        format: direct.format,
        direct: direct.dataUri != null,
      });
    }
    if (direct.dataUri || !direct.imageBase64) return;
    let live = true;
    // The extracted IMAGE, not the DG2 container — see ChipPortrait.imageBase64.
    void decodeChipImage(direct.imageBase64).then((jpegBase64) => {
      if (__DEV__) console.log('[myaza] chip portrait decode:', jpegBase64 ? 'ok' : 'declined');
      if (live && jpegBase64) setDecoded(`data:image/jpeg;base64,${jpegBase64}`);
    });
    return () => {
      live = false;
    };
  }, [dg2, direct.dataUri, direct.imageBase64]);

  return direct.dataUri ?? decoded;
}
