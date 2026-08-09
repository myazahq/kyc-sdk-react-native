import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Camera, useCameraDevice, useCameraDevices, usePhotoOutput, useVideoOutput, type CameraRef } from 'react-native-vision-camera';

import { radius, spacing } from '../config/theme';
import { FRAMED_VIEW_AR } from '../services/cardCrop';
import { DOCUMENT_VIDEO_BITRATE, VIDEO_CAPTURE_RESOLUTION } from '../config/captureSettings';
import { useTheme } from './runtime';
import { documentHintIsAction, documentHintText, useAutoCapture } from '../capture';
import { shortDocumentLabel } from '../config/idTypes';
import type { MrzScan } from '../mrz/parse';
import { useVideoRecorder } from './useVideoRecorder';
import { CardGuide } from './viewfinder/CardGuide';
import { HintBanner, OverlayButton, Shutter } from './viewfinder/ViewfinderControls';
import { ImmersiveOverlay } from './viewfinder/ImmersiveOverlay';

// Back-camera viewfinder for document capture — the RN mirror of the Flutter
// SDK's _DocumentViewfinder. Shows a VisionCamera preview with an ID-card guide
// overlay + manual shutter. This component is only rendered once a camera device
// exists (or while it's still resolving — a brief spinner); the "Camera not
// available" error (no device / init failure) is owned by the parent step, which
// shows a prominent error + upload fallback. Capture is manual (no edge detection).


export interface CameraViewfinderProps {
  active: boolean;
  side: 'front' | 'back';
  documentLabel: string;
  /** Receives the captured still + a best-effort short document video (or null). */
  onCapture: (
    uri: string,
    videoPath: string | null,
    /** Aspect (w÷h) of the box the preview rendered in — what the crop must match. */
    viewAr: number,
  ) => void;
  /** Card-guide aspect (width ÷ height): 1.586 for ID cards, 1.42 for passports. */
  guideAspect?: number;
  /** Capture is disabled while a previous capture/compress is in flight. */
  busy?: boolean;
  /** ISO-2 country + ID key — what auto-capture checks the document against. */
  country?: string;
  idType?: string;
  /** Banked when a frame yields a check-digit-valid MRZ (the chip's key). */
  onMrz?: (scan: MrzScan) => void;
  /** An MRZ is already stored, so the gate need not hold out for one. */
  mrzAlreadyCaptured?: boolean;
  /**
   * Fill the parent instead of sitting in a 3:4 box.
   *
   * Used by immersive capture: the camera owns the whole screen, because a
   * small preview is exactly what makes users hold a document too far away for
   * the MRZ to resolve.
   */
  fill?: boolean;
  /** Drawn top-left in immersive mode, where the sheet's chrome is gone. */
  onBack?: (() => void) | null;
  /** The gallery escape, kept in immersive mode — it is the fallback when the
   *  camera simply will not read a worn or laminated document. */
  onUpload?: (() => void) | null;
  /** Safe-area bottom inset; the full-bleed camera runs under the indicator. */
  bottomInset?: number;
}

export function CameraViewfinder({
  active,
  side,
  documentLabel,
  onCapture,
  guideAspect = 1.586,
  busy = false,
  country,
  idType,
  onMrz,
  mrzAlreadyCaptured = false,
  fill = false,
  onBack,
  onUpload,
  bottomInset = 0,
}: CameraViewfinderProps): React.ReactElement {
  const { colors } = useTheme();
  // Prefer a back camera that CAN torch, then fall back to the library's
  // default ranking. On multi-camera phones (seen live on a Galaxy S24) the
  // default pick can land on a flashless back device — CameraX then rejects
  // enableTorch with "No flash unit" — while a flash-capable back camera sits
  // right next to it in the list. `hasTorch` is trustworthy on the logical
  // device objects (it reads CameraX's hasFlashUnit()); only the
  // physical-device wrappers stub it, and those lose this find() either way.
  const allDevices = useCameraDevices();
  const defaultBack = useCameraDevice('back');
  const device = useMemo(
    () => allDevices.find((d) => d.position === 'back' && d.hasTorch) ?? defaultBack,
    [allDevices, defaultBack],
  );
  // v5: document-conservative still (OCR). Capture via the photo output, not a
  // camera ref. Quality is prioritised so small text stays legible.
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'quality' });
  // A short, bitrate-capped document video recorded alongside the still (uploaded
  // best-effort as document_front_video / document_back_video). Mirrors Flutter.
  const videoOutput = useVideoOutput({
    enableAudio: false,
    fileType: 'mp4',
    targetBitRate: DOCUMENT_VIDEO_BITRATE,
    targetResolution: VIDEO_CAPTURE_RESOLUTION,
    // iOS only honours targetBitRate/targetResolution on the AVAssetWriter
    // pipeline; without this it records full-quality (the front clip exceeded the
    // 25MB upload cap). This keeps the document video small.
    enablePersistentRecorder: true,
  });
  const ready = !!device;
  const recorder = useVideoRecorder(videoOutput, ready);

  // Record while the side's camera is live; restart when the side changes.
  useEffect(() => {
    if (active && ready) recorder.start();
    return () => {
      void recorder.stop();
    };
    // `side` in the deps restarts the recording for the back side.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready, side]);


  const capturingRef = useRef(false);
  const capture = useCallback(async () => {
    if (busy || !ready || capturingRef.current) return;
    // Guarded because auto-capture and the manual shutter can now both fire —
    // two concurrent captures contend for the camera and one of them fails.
    capturingRef.current = true;
    try {
      // Stop the video first (and grab its path) so the still and the clip don't
      // contend for the camera, then capture the OCR still.
      const videoPath = await recorder.stop();
      const file = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
      // The MEASURED box, via ref (state would be stale in this callback).
      // Full-screen capture shows a much taller slice of the photo than the
      // framed 3:4 box did; the crop must be told which one the user saw.
      const b = boxRef.current;
      const viewAr = b.width > 0 && b.height > 0 ? b.width / b.height : FRAMED_VIEW_AR;
      onCapture(`file://${file.filePath}`, videoPath, viewAr);
    } catch {
      /* a failed shutter is a no-op — the user can tap again */
    } finally {
      capturingRef.current = false;
    }
  }, [busy, ready, recorder, photoOutput, onCapture]);

  // ── Auto-capture ──────────────────────────────────────────────────────────
  // Runs only with a document to check against; without one there is nothing to
  // identify the frame as, and firing on "some text" would shoot anything.
  const auto = useAutoCapture({
    enabled: active && ready && !busy && !!country && !!idType,
    country: country ?? '',
    idType: idType ?? '',
    // The back has no branding to identify itself by — the gate relaxes its
    // identity and text-density demands there (see documentIdentity.ts).
    side,
    mrzAlreadyCaptured,
    onMrz,
    guideAspect,
    // Front and back are the same idType; without this the gate stays latched
    // from the front and the back never auto-captures.
    resetKey: side,
    onFire: () => void capture(),
  });

  // Torch — a document under glass or in a dim room is the commonest reason a
  // capture reads badly, and it is the one thing the user can fix instantly.
  const [torch, setTorch] = useState(false);
  const cameraRef = useRef<CameraRef>(null);

  // IMPERATIVE, verified toggling — not the declarative `torchMode` prop.
  // The prop path fires the controller call and drops the promise, so a
  // rejection (CameraX refuses enableTorch when the bound camera reports no
  // flash unit) leaves the button lit and the scene dark, with nothing in any
  // log. Await the call, read the REAL state back off the controller (its
  // getter reads CameraX TorchState, unlike the device object, whose
  // `hasTorch` is a hardcoded stub for physical devices in this VisionCamera
  // version), and keep UI state honest either way.
  const toggleTorch = useCallback(async () => {
    const controller = cameraRef.current?.controller;
    if (!controller) return;
    const next = !torch;
    try {
      await controller.setTorchMode(next ? 'on' : 'off');
      const actual = controller.torchMode === 'on';
      setTorch(actual);
      if (actual !== next && __DEV__) {
        console.warn('[kyc.camera] torch state did not follow the request');
      }
    } catch (err) {
      if (__DEV__) console.warn('[kyc.camera] torch toggle failed:', err);
      setTorch(false);
    }
  }, [torch]);
  // Honest again: the device SELECTION above prefers a torch-capable camera,
  // so when this is false there genuinely is no back camera with a flash unit
  // and the button would be a lie. (An earlier fix trusted Android blindly,
  // which produced a visible button driving a flashless camera — CameraX
  // rejected every toggle with "No flash unit".)
  const hasTorch = device?.hasTorch ?? false;

  const hintText = documentHintText(auto.guidance.hint, documentLabel);
  // The gate's live instruction once it has a document to judge; the static
  // prompt until then (it needs a country + ID type to say anything useful).
  const hint =
    country && idType
      ? hintText
      : `Align the ${side === 'back' ? 'BACK' : 'FRONT'} of your ${documentLabel}`;
  const hintIsAction = documentHintIsAction(auto.guidance.hint);

  // Immersive insets its own controls (there is no header to sit under).
  //
  // The guide is sized from the MEASURED container, not the window: on iOS the
  // modal is a pageSheet, which is inset from the top of the screen, so window
  // dimensions overshoot — the frame would sit low and the bottom bar would run
  // off the edge. onLayout gives the box this actually renders into.
  const [box, setBox] = useState({ width: 0, height: 0 });
  const boxRef = useRef(box);
  boxRef.current = box;
  const topInset = Platform.OS === 'ios' ? 56 : 32;

  return (
    <View
      onLayout={
        fill
          ? (e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width !== box.width || height !== box.height) setBox({ width, height });
            }
          : undefined
      }
      style={
        fill
          ? { flex: 1, overflow: 'hidden', backgroundColor: '#000000' }
          : { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#111111' }
      }
    >
      {/* Mounted only once permission is GRANTED, not merely when a device
          exists. VisionCamera configures its session on mount, and doing that
          during the brief "requesting" window throws "Camera Permission not yet
          granted!" as an uncaught rejection — `isActive={false}` does not
          prevent the configuration. */}
      {ready && active ? (
        <Camera
          ref={cameraRef}
          style={{ flex: 1 }}
          device={device}
          isActive={active}
          outputs={[photoOutput, videoOutput, auto.frameOutput]}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}

      {ready && active && fill && box.height > 0 ? (
        <ImmersiveOverlay
          side={side}
          country={country ?? ''}
          documentLabel={shortDocumentLabel(idType ?? null, documentLabel)}
          guideAspect={guideAspect}
          hint={hint}
          hintIsAction={hintIsAction}
          progress={auto.progress}
          busy={busy}
          torch={torch}
          hasTorch={hasTorch}
          onToggleTorch={() => void toggleTorch()}
          onCapture={capture}
          onBack={onBack ?? null}
          onUpload={onUpload ?? null}
          bottomInset={bottomInset}
          width={box.width}
          height={box.height}
          topInset={topInset}
          framing={auto.guidance.framing}
          showMrzBand={idType === 'passport'}
        />
      ) : null}

      {/* Framed (in-sheet) overlay */}
      {ready && active && !fill ? (
        <>
          <CardGuide guideAspect={guideAspect} primary={colors.primary} />
          <HintBanner
            fill={false}
            isAction={hintIsAction}
            text={hint}
          />

          {hasTorch ? (
            <OverlayButton
              icon="lightbulb"
              side="right"
              fill={false}
              active={torch}
              label={torch ? 'Turn off the torch' : 'Turn on the torch'}
              onPress={() => void toggleTorch()}
            />
          ) : null}
        </>
      ) : null}

      {/* Immersive draws its own shutter inside BottomBar (with the torch and
          the upload escape), so only the framed variant needs this one. */}
      {fill ? null : (
        <Shutter onPress={capture} ready={ready} busy={busy} progress={auto.progress} />
      )}
    </View>
  );
}
