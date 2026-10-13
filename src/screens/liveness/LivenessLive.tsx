import React from 'react';
import { View as RNView, type View } from 'react-native';
import type { CameraDevice, CameraViewProps } from 'react-native-vision-camera';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { UiText } from '../../components/Typography';
import { UiButton } from '../../components/UiButton';
import { GESTURE_FULL_SIZE, gestureSize, ROOM_FOR_GESTURE, type Size } from '../../lib/livenessCutout';
import { lightingGuidanceText, type useLiveness } from '../../liveness/useLiveness';
import { LivenessAvatar } from '../LivenessAvatar';
import { ImmersiveFrame } from './ImmersiveFrame';
import { backdropNeedsTexture, CameraBackdrop } from './Backdrop';
import { GesturePlate, Panel, Reassurance, StepCount } from './ImmersiveSurfaces';
import { InstructionPill } from './InstructionPill';
import { LightingBanner } from './LightingBanner';
import { LivenessCamera } from './LivenessCamera';
import { LivenessWindow } from './LivenessWindow';

// ---------------------------------------------------------------------------
// The live liveness camera, full screen: the camera edge to edge, sharp in a
// window for the face and blurred everywhere around it, the instruction above the window and
// the step count below.
//
// A check that runs out of time stays on this screen, as it does on Flutter:
// the camera keeps running, and the reason and Try Again take the place of the
// step count. Sending the person to a different screen to press one button
// tore down the camera they were about to need again.
//
// The gesture's picture sits ABOVE the window with the words it illustrates.
// The front camera is at the top of the phone: eyes that go up to read stay
// near the lens, while eyes that drop to the bottom of the screen tip the head
// down, which is the wrong pose for the photo and for a nod being judged.
// ---------------------------------------------------------------------------

export function LivenessLive({
  liveness,
  guidance,
  device,
  cameraActive,
  outputs,
  getRingTarget,
  windowRef,
  dimRoom,
  failure,
  onFrameSize,
}: {
  liveness: ReturnType<typeof useLiveness>;
  guidance: { text: string; tone: 'normal' | 'error' };
  device: CameraDevice | undefined;
  cameraActive: boolean;
  outputs: NonNullable<CameraViewProps['outputs']>;
  getRingTarget: () => number;
  windowRef: React.RefObject<View | null>;
  dimRoom: boolean;
  /** Why the check stopped, with its retry, or null while it is running. */
  failure: { message: string; onRetry: () => void } | null;
  onFrameSize: (size: Size) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const phase = liveness.phase;
  const loading = phase === 'loading';
  const challenge = liveness.activeChallenge;
  const showsGesture =
    challenge != null &&
    challenge !== 'hold' &&
    (phase === 'challenge' || phase === 'challenge_passed' || phase === 'positioning');
  const warning =
    liveness.wrongGesture ||
    liveness.multipleFaces ||
    liveness.positionGuidance != null ||
    liveness.lightingGuidance != null;
  const tone =
    guidance.tone === 'error'
      ? 'warning'
      : phase === 'challenge_passed' || phase === 'complete'
        ? 'done'
        : 'prompt';
  // Where the test has got to, in words, where the sheet has its dots.
  const total = liveness.totalCount;
  const showsCount = !failure && total > 1 && (phase === 'challenge' || phase === 'challenge_passed');
  const step = Math.min(liveness.completedCount + (phase === 'challenge' ? 1 : 0), total);
  // The line about the connection stays until the photo is taken. It used to
  // go as soon as a gesture was asked for, which left it on screen for about a
  // second and a half: too short to be read at all.
  const beforeCapture = phase !== 'complete';
  const lighting = liveness.lightingGuidance;

  const gesture = (size: number, compact: boolean): React.ReactNode =>
    showsGesture && challenge ? (
      <GesturePlate compact={compact}>
        <LivenessAvatar challenge={challenge} size={size} iconSize={size / 2} />
      </GesturePlate>
    ) : null;

  return (
    <ImmersiveFrame
      onSize={onFrameSize}
      backdrop={(frame, window) => (
        <CameraBackdrop
          frame={frame}
          window={window}
          dimRoom={dimRoom}
          camera={
            <LivenessCamera
              device={device}
              active={cameraActive}
              outputs={outputs}
              texture={backdropNeedsTexture}
            />
          }
        />
      )}
      cutout={(window) => (
        <LivenessWindow
          window={window}
          phase={phase}
          warning={warning && !loading}
          loading={loading}
          getRingTarget={getRingTarget}
          // Positioning, each step, the capture: livenessProgress's own parts.
          segments={liveness.totalCount + 2}
          windowRef={windowRef}
        />
      )}
      above={(room, reach) => {
        if (failure) return null;
        // The picture stands on its own above the words, and it is narrow, so
        // it may rise between the back and close buttons: its size comes from
        // the room up to the TOP of those buttons (lib/livenessCutout.ts
        // gestureSize). The long lighting note is wide, so it only shows when
        // everything fits under the buttons, and the picture gives it room.
        const showsLighting = lighting != null && room >= ROOM_FOR_GESTURE + 70;
        const size = gestureSize(showsLighting ? room - 70 : reach, GESTURE_FULL_SIZE);
        return (
          <RNView style={{ alignItems: 'center', gap: spacing.sm }}>
            {showsLighting && lighting ? (
              <LightingBanner text={lightingGuidanceText(lighting)} />
            ) : null}
            {gesture(size, false)}
            <InstructionPill text={phase === 'flash' ? '' : guidance.text} tone={tone} />
          </RNView>
        );
      }}
      below={
        failure ? (
          // Its own surface: red text straight on the camera would be lost.
          <Panel>
            <UiText
              variant="bodyMedium"
              color={colors.error}
              accessibilityRole="alert"
              style={{ textAlign: 'center', fontWeight: '500' }}
            >
              {failure.message}
            </UiText>
            <RNView style={{ height: spacing.md }} />
            <UiButton label="Try Again" onPress={failure.onRetry} />
          </Panel>
        ) : showsCount ? (
          <StepCount step={step} total={total} />
        ) : undefined
      }
      footer={failure ? undefined : <Reassurance visible={beforeCapture} />}
    />
  );
}
