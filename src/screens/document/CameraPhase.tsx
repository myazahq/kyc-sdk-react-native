import React from 'react';
import { Modal, Pressable, View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { CameraViewfinder } from '../../components/CameraViewfinder';
import { RequiredPill } from './RequiredPill';
import type { MrzScan } from '../../mrz/parse';

export interface CameraPhaseProps {
  isBack: boolean;
  /** True once the live preview is actually on screen — drives immersive mode. */
  cameraLive: boolean;
  active: boolean;
  documentLabel: string;
  guideAspect: number;
  isTwoSided: boolean;
  busy: boolean;
  allowUpload: boolean;
  country: string;
  idType?: string;
  mrzAlreadyCaptured: boolean;
  onMrz: (scan: MrzScan) => void;
  onCapture: (uri: string, videoPath: string | null, viewAr: number) => void;
  onUpload: () => void;
  onBack: () => void;
  /** Safe-area bottom inset for the full-bleed camera's controls. */
  bottomInset?: number;
}

/**
 * The document-capture camera, in both of its shapes.
 *
 * IMMERSIVE is the normal one: the camera owns the screen, because the sheet's
 * header, padding and scroll view are exactly what force a small viewfinder on
 * a short phone — and a camera you have to scroll to is a broken camera. The
 * pill and helper text go with it; the viewfinder carries that information as
 * live overlays instead.
 *
 * The framed shape below it is what renders in the brief window while the OS
 * permission prompt is open, where there is no live preview to hand the screen
 * to yet.
 */
export function CameraPhase(p: CameraPhaseProps): React.ReactElement {
  const { colors } = useTheme();

  const viewfinder = (extra: {
    fill?: boolean;
    onBack?: () => void;
    onUpload?: (() => void) | null;
    bottomInset?: number;
  }) => (
    <CameraViewfinder
      active={p.active}
      side={p.isBack ? 'back' : 'front'}
      documentLabel={p.documentLabel}
      guideAspect={p.guideAspect}
      onCapture={p.onCapture}
      busy={p.busy}
      // Auto-capture needs to know WHICH document it is looking for — without
      // this it would fire on any text-dense frame.
      country={p.country}
      idType={p.idType}
      // Banking the MRZ from a live frame is what spares the user scanning the
      // same passport again at the chip step. Only the front carries one.
      onMrz={p.isBack ? undefined : p.onMrz}
      mrzAlreadyCaptured={p.mrzAlreadyCaptured}
      {...extra}
    />
  );

  if (p.cameraLive) {
    // A FULL-SCREEN modal of its own, not just full-bleed content.
    //
    // The SDK's sheet is an iOS pageSheet: inset from the top, rounded, with
    // the card visible behind it. Filling that still leaves the camera in a
    // letterboxed card — and a document held at arm's length needs every pixel.
    //
    // Presenting it as a Modal rather than switching the sheet's own
    // presentationStyle matters: a Modal's children stay in the SAME React
    // tree, so this step keeps its state (the acknowledged primer, the captured
    // front) — where changing presentationStyle on a live modal remounts the
    // subtree and loses it. It closes when the capture finishes, and the sheet
    // is exactly as it was.
    return (
      <Modal
        visible
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={p.onBack}
      >
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          {viewfinder({
            fill: true,
            onBack: p.onBack,
            // The gallery escape stays reachable full-screen: it is the
            // fallback when the camera will not read a worn or laminated
            // document.
            onUpload: p.allowUpload ? p.onUpload : null,
            bottomInset: p.bottomInset ?? 0,
          })}
        </View>
      </Modal>
    );
  }

  return (
    <View>
      <RequiredPill
        documentLabel={p.documentLabel}
        sideBadge={p.isTwoSided ? (p.isBack ? 'Back Side' : 'Front Side') : undefined}
        stepLabel={p.isTwoSided ? (p.isBack ? 'Step 2 of 2' : 'Step 1 of 2') : undefined}
      />
      {p.isBack ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xs }}>
          <Icon name="credit-card" size={14} color={colors.primary} />
          <View style={{ width: 4 }} />
          <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '500' }}>
            Flip the card over and scan the other side
          </MyazaText>
        </View>
      ) : null}
      <View style={{ height: spacing.md }} />
      {viewfinder({})}
      {!p.busy ? (
        <>
          <View style={{ height: spacing.md }} />
          <MyazaText variant="bodySmall" style={{ textAlign: 'center' }}>
            Tap the button to capture manually
          </MyazaText>
          {p.allowUpload ? (
            <Pressable onPress={p.onUpload} style={{ marginTop: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <MyazaText variant="bodySmall">Having trouble? </MyazaText>
                <Icon name="upload" size={14} color={colors.primary} />
                <View style={{ width: 4 }} />
                <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '700' }}>
                  Upload a photo instead
                </MyazaText>
              </View>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
