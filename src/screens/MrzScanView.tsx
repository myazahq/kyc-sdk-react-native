import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera';
import { runOnJS } from 'react-native-worklets';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MyazaPulseLoader } from '../components/MyazaPulseLoader';
import { extractMrz } from '../mrz/extract';
import { recognizeMrzLines, MRZ_BAND_FRACTION } from '../mrz/textRecognizer';
import type { MrzScan } from '../mrz/parse';

// ---------------------------------------------------------------------------
// Live MRZ scan — the camera fallback that unlocks the chip.
//
// The MRZ printed on the photo page IS the chip's access key (document number,
// date of birth, expiry). The document step normally lifts it off the photo the
// user already took; when that read fails there was previously nowhere to go,
// and the chip simply could not be opened. This is that second chance, and it
// is the same capability the Flutter SDK offers.
//
// Frames are recognised one at a time — `dropFramesWhileBusy` skips whatever
// arrives mid-recognition rather than queueing it. OCR is far slower than the
// camera, so a queue would only serve progressively staler frames.
//
// A frame that does not yield a CHECK-DIGIT-VALID MRZ is discarded silently and
// the next one tried. That is what makes continuous scanning feel instant while
// still refusing a misread: the check digits are the whole reason this can be
// trusted to run unattended, since a wrong key just makes the chip refuse.
// ---------------------------------------------------------------------------

export function MrzScanView({
  onScanned,
}: {
  onScanned: (scan: MrzScan) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [denied, setDenied] = useState(false);

  // A ref, not state: the worklet callback lands on the JS thread after the
  // frame that found the MRZ, and a stale render would let a second frame
  // report the same document again.
  const doneRef = useRef(false);

  const handleLines = useCallback(
    (lines: string[]) => {
      if (doneRef.current || lines.length === 0) return;
      const scan = extractMrz(lines);
      if (!scan) return; // partial or misread — keep looking
      doneRef.current = true;
      onScanned(scan);
    },
    [onScanned],
  );

  const frameOutput = useFrameOutput({
    // Both recognisers (Apple Vision, ML Kit) consume YUV directly, so this
    // avoids a conversion per frame.
    pixelFormat: 'yuv',
    dropFramesWhileBusy: true,
    onFrame: (frame) => {
      'worklet';
      const lines = recognizeMrzLines(frame);
      frame.dispose();
      runOnJS(handleLines)(lines);
    },
    // Drops are the normal state of affairs here, not a fault worth logging.
    onFrameDropped: () => {
      'worklet';
    },
  });

  const askForCamera = useCallback(() => {
    void requestPermission().then((granted) => {
      if (!granted) setDenied(true);
    });
  }, [requestPermission]);

  if (!hasPermission) {
    return (
      <Centered>
        <MyazaText variant="bodyMedium" style={{ textAlign: 'center' }}>
          {denied
            ? 'Camera access is off, so the printed code cannot be read. You can still continue without the chip.'
            : 'We need the camera to read the printed code on your document.'}
        </MyazaText>
        {denied ? null : (
          <>
            <View style={{ height: spacing.md }} />
            <MyazaButton label="Allow camera" onPress={askForCamera} />
          </>
        )}
      </Centered>
    );
  }

  if (device == null) {
    return (
      <Centered>
        <MyazaText variant="bodyMedium" color={colors.error} style={{ textAlign: 'center' }}>
          No camera is available on this device.
        </MyazaText>
      </Centered>
    );
  }

  return (
    <View
      style={{
        // 1.42:1 — a passport photo page is wider than it is tall, and framing
        // the preview to the document is what stops users holding it too far
        // away for the MRZ glyphs to resolve.
        aspectRatio: 1.42,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: colors.textDark,
      }}
    >
      <Camera
        style={{ flex: 1 }}
        device={device}
        isActive
        outputs={[frameOutput]}
      />

      {/* The band the recogniser actually reads, drawn so the user aims the
          strip into it rather than guessing. Kept in lockstep with
          MRZ_BAND_FRACTION — a guide that disagrees with the crop would send
          people to aim at the wrong part of the page. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: `${MRZ_BAND_FRACTION * 100}%`,
          borderTopWidth: 2,
          borderColor: `${colors.primary}CC`,
          backgroundColor: `${colors.primary}14`,
        }}
      />

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: spacing.sm,
          alignItems: 'center',
        }}
      >
        <MyazaPulseLoader size={20} />
      </View>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>{children}</View>
  );
}
