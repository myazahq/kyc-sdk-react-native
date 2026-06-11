import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg';
import { Camera, useCameraDevice, usePhotoOutput, useVideoOutput } from 'react-native-vision-camera';

import { radius, spacing } from '../config/theme';
import { DOCUMENT_VIDEO_BITRATE, VIDEO_CAPTURE_RESOLUTION } from '../config/captureSettings';
import { useTheme } from './runtime';
import { useVideoRecorder } from './useVideoRecorder';
import { MyazaText } from './Typography';
import { Icon } from './Icon';

// Back-camera viewfinder for document capture — the RN mirror of the Flutter
// SDK's _DocumentViewfinder. Shows a VisionCamera preview with an ID-card guide
// overlay + manual shutter. This component is only rendered once a camera device
// exists (or while it's still resolving — a brief spinner); the "Camera not
// available" error (no device / init failure) is owned by the parent step, which
// shows a prominent error + upload fallback. Capture is manual (no edge detection).

// Card window within the 3:4 viewBox (centred). Height follows the per-ID guide
// aspect so the overlay matches the auto-crop (cropCardRegion).
const VB_W = 100;
const VB_H = 133;
const GX = 6;
const GW = 88;
const C = 7; // corner accent length

export interface CameraViewfinderProps {
  active: boolean;
  side: 'front' | 'back';
  documentLabel: string;
  /** Receives the captured still + a best-effort short document video (or null). */
  onCapture: (uri: string, videoPath: string | null) => void;
  /** Card-guide aspect (width ÷ height): 1.586 for ID cards, 1.42 for passports. */
  guideAspect?: number;
  /** Capture is disabled while a previous capture/compress is in flight. */
  busy?: boolean;
}

export function CameraViewfinder({
  active,
  side,
  documentLabel,
  onCapture,
  guideAspect = 1.586,
  busy = false,
}: CameraViewfinderProps): React.ReactElement {
  const { colors } = useTheme();
  const device = useCameraDevice('back');
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

  const GH = GW / guideAspect;
  const GY = (VB_H - GH) / 2;

  const capture = async () => {
    if (busy || !ready) return;
    try {
      // Stop the video first (and grab its path) so the still and the clip don't
      // contend for the camera, then capture the OCR still.
      const videoPath = await recorder.stop();
      const file = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
      onCapture(`file://${file.filePath}`, videoPath);
    } catch {
      /* a failed shutter is a no-op — the user can tap again */
    }
  };

  return (
    <View style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#111111' }}>
      {ready ? (
        <Camera style={{ flex: 1 }} device={device} isActive={active} outputs={[photoOutput, videoOutput]} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}

      {/* Card-guide overlay (only over a live preview) */}
      {ready ? (
        <>
          <Svg style={{ position: 'absolute', inset: 0 }} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
            <Defs>
              <Mask id="cardMask">
                <Rect width={VB_W} height={VB_H} fill="white" />
                <Rect x={GX} y={GY} width={GW} height={GH} rx={3} fill="black" />
              </Mask>
            </Defs>
            <Rect width={VB_W} height={VB_H} fill="rgba(0,0,0,0.55)" mask="url(#cardMask)" />
            <Rect x={GX} y={GY} width={GW} height={GH} rx={3} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={0.6} strokeDasharray="5 3" />
            <Path d={`M${GX},${GY + C} L${GX},${GY} L${GX + C},${GY}`} stroke={colors.primary} strokeWidth={1.6} fill="none" strokeLinecap="round" />
            <Path d={`M${GX + GW - C},${GY} L${GX + GW},${GY} L${GX + GW},${GY + C}`} stroke={colors.primary} strokeWidth={1.6} fill="none" strokeLinecap="round" />
            <Path d={`M${GX + GW},${GY + GH - C} L${GX + GW},${GY + GH} L${GX + GW - C},${GY + GH}`} stroke={colors.primary} strokeWidth={1.6} fill="none" strokeLinecap="round" />
            <Path d={`M${GX + C},${GY + GH} L${GX},${GY + GH} L${GX},${GY + GH - C}`} stroke={colors.primary} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          </Svg>
          <View style={{ position: 'absolute', top: spacing.md, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: spacing.sm + 4, paddingVertical: 6, borderRadius: radius.full }}>
              <MyazaText variant="bodySmall" color="#FFFFFF">
                {`Align the ${side === 'back' ? 'BACK' : 'FRONT'} of your ${documentLabel}`}
              </MyazaText>
            </View>
          </View>
        </>
      ) : null}

      {/* Shutter — disabled when the camera isn't ready */}
      <View style={{ position: 'absolute', bottom: spacing.lg, left: 0, right: 0, alignItems: 'center' }}>
        <Pressable
          onPress={capture}
          disabled={busy || !ready}
          accessibilityRole="button"
          accessibilityLabel="Capture photo"
          style={({ pressed }) => ({
            width: 64,
            height: 64,
            borderRadius: radius.full,
            backgroundColor: ready ? '#FFFFFF' : colors.gray400,
            borderWidth: 4,
            borderColor: ready ? colors.primary : colors.gray300,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.6 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          {busy ? <ActivityIndicator color={colors.primary} /> : <Icon name="camera" size={24} color={ready ? colors.primary : '#FFFFFF'} />}
        </Pressable>
      </View>
    </View>
  );
}
