import React from 'react';
import { View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../runtime';
import { ImmersiveGuide } from './ImmersiveGuide';
import { DocumentPill, RoundControl, SideBadge } from './ImmersiveControls';
import { BottomBar } from './ImmersiveBottomBar';
import type { DocumentFraming } from '../../capture';

/**
 * Everything drawn over the full-screen camera.
 *
 * Composed here rather than in CameraViewfinder so that file stays about camera
 * wiring — and so the immersive layout can be read in one place against the
 * Flutter screen it mirrors.
 */
export function ImmersiveOverlay(p: {
  side: 'front' | 'back';
  country: string;
  documentLabel: string;
  guideAspect: number;
  hint: string;
  hintIsAction: boolean;
  progress: number;
  busy: boolean;
  torch: boolean;
  hasTorch: boolean;
  onToggleTorch: () => void;
  onCapture: () => void;
  onBack: (() => void) | null;
  onUpload: (() => void) | null;
  bottomInset: number;
  width: number;
  height: number;
  topInset: number;
  framing: DocumentFraming;
  /** Passports carry an MRZ band; the ghost draws it so it is not cropped. */
  showMrzBand: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <>
      <ImmersiveGuide
        guideAspect={p.guideAspect}
        primary={colors.primary}
        width={p.width}
        height={p.height}
        framing={p.framing}
        showMrzBand={p.showMrzBand}
      />
      {p.onBack ? (
        <RoundControl
          icon="back"
          label="Go back"
          onPress={p.onBack}
          style={{ top: p.topInset, left: spacing.md }}
        />
      ) : null}
      <SideBadge side={p.side} top={p.topInset + 4} />
      <DocumentPill country={p.country} label={p.documentLabel} top={p.topInset + 62} />
      <BottomBar
        hint={p.hint}
        hintIsAction={p.hintIsAction}
        allowUpload={!!p.onUpload}
        onUpload={() => p.onUpload?.()}
        onCapture={p.onCapture}
        busy={p.busy}
        ready
        progress={p.progress}
        hasTorch={p.hasTorch}
        torch={p.torch}
        onToggleTorch={p.onToggleTorch}
        bottomInset={p.bottomInset}
      />
      <View pointerEvents="none" />
    </>
  );
}
