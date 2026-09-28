import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCamera, useCameraDevice, usePhotoOutput, type CameraDevice } from 'react-native-vision-camera';

import { useKyc } from '../../components/runtime';
import { compressSelfieImage } from '../../services/mediaCompress';
import { withRetry } from '../../services/retry';
import { SILENT_DOCUMENT_SETTLE_MS, SILENT_FRONT_OPEN_DELAY_MS } from '../../lib/silentCapture';

// ─── Silent capture on the document review ──────────────────────────────────
//
// One unposed frame of the applicant per review (lib/silentCapture has the
// rules; the store holds the frames and enforces the cap of three across
// retakes). The document is shot with the REAR camera, so by the review it is
// closed and the person is looking at the photo they just took: the front
// camera is opened headless (useCamera, no preview view), given a moment for
// exposure to settle, and one frame is taken with flash and shutter sound off.
// The camera is then closed. Nothing renders and nothing waits on it: every
// failure (no front camera, a busy device, a failed upload) is simply a frame
// that is not submitted.
//
// Mount it only while the review is on screen and camera access is granted;
// give each review visit its own key so a retake takes a fresh frame.

export function SilentFrontCapture(): React.ReactElement | null {
  const device = useCameraDevice('front');
  return device ? <FrontGrab device={device} /> : null;
}

function FrontGrab({ device }: { device: CameraDevice }): null {
  const api = useKyc((s) => s.api);
  const reserve = useKyc((s) => s.reserveSilentFrame);
  const settle = useKyc((s) => s.settleSilentFrame);
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'speed' });
  const outputs = useMemo(() => [photoOutput], [photoOutput]);

  // Opened after a beat (the rear camera's session is still closing), and
  // closed as soon as the frame is taken or anything fails.
  const [open, setOpen] = useState(false);
  const doneRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!doneRef.current) setOpen(true);
    }, SILENT_FRONT_OPEN_DELAY_MS);
    return () => {
      clearTimeout(t);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  const finish = useCallback(() => {
    doneRef.current = true;
    setOpen(false);
  }, []);

  const take = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const slot = reserve('document');
    if (!slot) {
      setOpen(false);
      return;
    }
    const drop = () => settle(slot.index, slot.capturedAt, null);
    photoOutput
      .capturePhotoToFile({ flashMode: 'off', enableShutterSound: false }, {})
      .then(
        (file) => {
          setOpen(false);
          // Background from here on: re-encode to JPEG (the output may write
          // HEIC, and the server takes JPEG only), then upload.
          void (async () => {
            const jpeg = await compressSelfieImage(`file://${file.filePath}`).catch(() => null);
            if (!jpeg) return drop();
            try {
              const mediaId = await withRetry(() =>
                api.upload({ uri: jpeg, type: 'image/jpeg', name: 'silent_capture.jpg' }, 'silent_capture'),
              );
              settle(slot.index, slot.capturedAt, mediaId);
            } catch {
              drop();
            }
          })();
        },
        () => {
          setOpen(false);
          drop();
        },
      );
  }, [api, photoOutput, reserve, settle]);

  const onStarted = useCallback(() => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(take, SILENT_DOCUMENT_SETTLE_MS);
  }, [take]);

  useCamera({
    isActive: open,
    device,
    outputs,
    onStarted,
    // Silent by contract: a camera that will not open costs a photo, nothing
    // more (the library's default handler logs to the console).
    onError: finish,
  });
  return null;
}
