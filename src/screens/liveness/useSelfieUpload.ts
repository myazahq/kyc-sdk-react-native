import { useCallback, useRef, useState } from 'react';

import { MAX_VIDEO_BYTES } from '../../config/captureSettings';
import { compressVideo } from '../../services/mediaCompress';
import { withRetry } from '../../services/retry';
import { mapToKycError, safeReportError } from '../../services/errors';
import { useKyc, useKycConfig } from '../../components/runtime';
import { useToast } from '../../components/toast';

// ---------------------------------------------------------------------------
// The selfie and its liveness video, uploaded as soon as they exist.
//
// Split out of LivenessStep (200-line rule). It is a genuine boundary, not a
// slice for size: everything here is about getting two files to the server and
// reporting how that went, and none of it touches the camera or the state
// machine.
//
// The two uploads are deliberately NOT equal. The selfie is the verification —
// its failure is surfaced, retried and reported. The video is supporting
// evidence the server re-scores, so a failure there is swallowed: losing it must
// never block a user who has already done everything asked of them.
// ---------------------------------------------------------------------------

export interface SelfieUpload {
  selfieUri: string | null;
  setSelfieUri: (uri: string | null) => void;
  uploading: boolean;
  /** Which retry attempt is in flight, for the "retrying (2/3)" line. */
  retryInfo: { attempt: number; total: number } | null;
  uploadError: string | null;
  setUploadError: (message: string | null) => void;
  /** The uploaded selfie's media id — Continue is gated on it. */
  selfieIdRef: React.MutableRefObject<string | null>;
  /**
   * The finished liveness-video path, kept so the review screen's "Try Again"
   * can re-upload it. The recorder itself lives in useVideoRecorder.
   */
  videoPathRef: React.MutableRefObject<string | null>;
  uploadSelfieAndVideo: (selfie: string, videoPath: string | null) => Promise<void>;
}

export function useSelfieUpload(): SelfieUpload {
  const toast = useToast();
  const config = useKycConfig();
  const api = useKyc((s) => s.api);
  const setMediaId = useKyc((s) => s.setMediaId);

  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const selfieIdRef = useRef<string | null>(null);
  const videoPathRef = useRef<string | null>(null);

  const uploadSelfieAndVideo = useCallback(
    async (selfie: string, videoPath: string | null) => {
      setUploading(true);
      setUploadError(null);
      setRetryInfo(null);
      const onRetry = (attempt: number, total: number) => setRetryInfo({ attempt, total });
      try {
        const selfieId = await withRetry(
          () => api.upload({ uri: selfie, type: 'image/jpeg' }, 'selfie'),
          { onRetry },
        );
        selfieIdRef.current = selfieId;
        setMediaId('selfie', selfieId);
        // Liveness video is best-effort — a failure here must not block the user.
        if (videoPath) {
          try {
            // Transcode the raw recording down to a small evidence clip first.
            const small = await compressVideo(videoPath);
            const videoId = await withRetry(
              () => api.upload({ uri: small, type: 'video/mp4' }, 'liveness_video', MAX_VIDEO_BYTES),
              { onRetry },
            );
            setMediaId('livenessVideo', videoId);
          } catch {
            /* keep the selfie, drop the video (incl. if it exceeded the 5MB cap) */
          }
        }
        setRetryInfo(null);
        setUploading(false);
      } catch (err) {
        setRetryInfo(null);
        setUploading(false);
        const kycError = mapToKycError(err, 'upload');
        setUploadError(kycError.message);
        toast.show({ variant: 'error', title: 'Upload failed', message: kycError.message });
        safeReportError(config.onError, kycError);
      }
    },
    [api, setMediaId, config.onError, toast],
  );

  return {
    selfieUri,
    setSelfieUri,
    uploading,
    retryInfo,
    uploadError,
    setUploadError,
    selfieIdRef,
    videoPathRef,
    uploadSelfieAndVideo,
  };
}
