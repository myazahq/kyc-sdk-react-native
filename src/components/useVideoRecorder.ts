import { useCallback, useRef } from 'react';
import type { CameraVideoOutput, Recorder } from 'react-native-vision-camera';

import { MAX_VIDEO_DURATION_MS } from '../config/captureSettings';

// Shared best-effort video recorder for the VisionCamera v5 output model, used by
// both the liveness selfie video and the document-capture videos. Mirrors the
// Flutter SDK's "record while the camera is live, stop when the still is taken,
// upload best-effort" pattern.
//
// Three robustness concerns are handled here:
//  • The video output connects to the camera session a moment after mount, so the
//    first start can throw "VideoOutput is not yet connected" — we retry briefly.
//  • The finished file path arrives via the `onRecordingFinished` callback (not the
//    stopRecording promise), so we bridge the two and bound the wait.
//  • A hard duration cap (MAX_VIDEO_DURATION_MS) auto-stops the recording so a long
//    camera session can't bloat the file past the upload ceiling.

export interface VideoRecorderHandle {
  /** Start recording (no-op if disabled or already recording). */
  start: () => void;
  /** Stop and resolve the recorded `file://` path, or null if nothing recorded. */
  stop: () => Promise<string | null>;
  /** True while a recording is in progress. */
  isRecording: () => boolean;
}

export function useVideoRecorder(videoOutput: CameraVideoOutput, enabled: boolean): VideoRecorderHandle {
  const recordingRef = useRef(false);
  const recorderRef = useRef<Recorder | null>(null);
  const pathRef = useRef<string | null>(null);
  const finishedRef = useRef<Promise<string | null> | null>(null);
  const resolveFinishedRef = useRef<((p: string | null) => void) | null>(null);
  const stoppingRef = useRef(false);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (recordingRef.current || !enabled) return;
    recordingRef.current = true;
    stoppingRef.current = false;
    pathRef.current = null;
    finishedRef.current = new Promise<string | null>((resolve) => {
      resolveFinishedRef.current = resolve;
    });
    void (async () => {
      const onFinished = (filePath: string) => {
        pathRef.current = `file://${filePath}`;
        resolveFinishedRef.current?.(pathRef.current);
        resolveFinishedRef.current = null;
      };
      const onError = () => {
        recordingRef.current = false;
        recorderRef.current = null;
        resolveFinishedRef.current?.(null);
        resolveFinishedRef.current = null;
      };
      // Retry until the video output is connected to the session (~2.4s); the
      // "not yet connected" error is transient. Any other error → bail (best-effort).
      for (let attempt = 0; attempt < 12; attempt++) {
        if (!recordingRef.current) return; // stopped before it ever started
        try {
          const recorder = await videoOutput.createRecorder({});
          await recorder.startRecording(onFinished, onError);
          recorderRef.current = recorder;
          // Hard length cap — stop the recording (path arrives via onFinished); a
          // later stop() will just await the already-resolved path.
          autoStopRef.current = setTimeout(() => {
            if (recorderRef.current && !stoppingRef.current) {
              stoppingRef.current = true;
              void recorderRef.current.stopRecording().catch(() => {});
            }
          }, MAX_VIDEO_DURATION_MS);
          return; // recording is live
        } catch (e) {
          const msg = String(e);
          if (msg.includes('not yet connected') || msg.includes('CameraSession')) {
            await new Promise((r) => setTimeout(r, 200));
            continue;
          }
          break;
        }
      }
      recordingRef.current = false;
      recorderRef.current = null;
      resolveFinishedRef.current?.(null);
      resolveFinishedRef.current = null;
    })();
  }, [videoOutput, enabled]);

  const stop = useCallback(async (): Promise<string | null> => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (!recordingRef.current) return pathRef.current;
    if (!recorderRef.current) {
      // Still in the start-retry loop (output not connected yet) — cancel it.
      recordingRef.current = false;
      return pathRef.current;
    }
    if (!stoppingRef.current) {
      stoppingRef.current = true;
      try {
        await recorderRef.current.stopRecording();
      } catch {
        /* already stopping / not started — fall through to the path wait */
      }
    }
    // The final path arrives via onRecordingFinished; bound the wait (~2s).
    const path = await Promise.race([
      finishedRef.current ?? Promise.resolve(pathRef.current),
      new Promise<string | null>((resolve) => setTimeout(() => resolve(pathRef.current), 2000)),
    ]);
    recordingRef.current = false;
    recorderRef.current = null;
    return path;
  }, []);

  const isRecording = useCallback(() => recordingRef.current, []);

  return { start, stop, isRecording };
}
