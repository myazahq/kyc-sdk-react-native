import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { Icon, type IconName } from '../../components/Icon';
import { DashedBorder } from '../../components/DashedBorder';
import { RequiredPill } from './RequiredPill';
import { useText } from '../../i18n/useText';

// ─── Document capture without the camera ──────────────────────────────────────
//
// One side of the document when the workflow switches scanning off
// (`allowDocumentScan: false`): a photo chosen from the device, never a camera
// shot. It renders in place of the camera gates, and nothing here touches
// VisionCamera, so an upload-only flow never asks for camera access and never
// records a capture video.
//
// Only the ASK differs. What happens after the pick is the step's own and shared
// with the camera path: the interactive cropper, the compress, the MRZ read off
// the front, the front preview and the review.

// The web's second and third upload tips; this screen has no "lay it flat" one.
const TIPS: ReadonlyArray<{ icon: IconName; key: string }> = [
  { icon: 'id-card', key: 'uploadDocument.upload.tip2' },
  { icon: 'sun', key: 'uploadDocument.upload.tip3' },
];

export interface UploadPhaseProps {
  isBack: boolean;
  documentLabel: string;
  isTwoSided: boolean;
  /** A picked photo is being cropped and compressed. */
  busy: boolean;
  onUpload: () => void;
}

export function UploadPhase(p: UploadPhaseProps): React.ReactElement {
  const { colors } = useTheme();
  const t = useText();
  const subject = !p.isTwoSided ? `your ${p.documentLabel}` : p.isBack ? 'the back' : 'the front';
  const ask = `Add a photo of ${subject}`;
  const choose = () => {
    if (!p.busy) p.onUpload();
  };

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
            Turn the card over and add a photo of the other side
          </MyazaText>
        </View>
      ) : null}
      <View style={{ height: spacing.md }} />

      {/* The whole card is the target and there is no button beside it: on a
          screen whose only job is to open the photo picker, the card is where
          the thumb goes. A press deepens the fill and solidifies the border;
          the primary line at the bottom says what a tap does. */}
      <Pressable
        testID={`kyc.document.upload.${p.isBack ? 'back' : 'front'}`}
        onPress={choose}
        disabled={p.busy}
        accessibilityRole="button"
        accessibilityLabel={p.busy ? 'Preparing your photo' : ask}
        accessibilityHint="Opens your photos"
        accessibilityState={{ busy: p.busy, disabled: p.busy }}
        style={({ pressed }) => ({
          alignItems: 'center',
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          backgroundColor: pressed ? `${colors.primary}1A` : `${colors.primary}0D`,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        {({ pressed }) => (
          <>
            <DashedBorder
              color={pressed ? colors.primary : `${colors.primary}66`}
              radius={radius.md}
              strokeWidth={1.5}
            />
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.full,
                backgroundColor: `${colors.primary}1A`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {p.busy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Icon name="image" size={30} color={colors.primary} />
              )}
            </View>
            <View style={{ height: spacing.md }} />
            <MyazaText variant="heading3" style={{ textAlign: 'center' }}>
              {p.busy ? 'Preparing your photo…' : ask}
            </MyazaText>
            <View style={{ height: spacing.xs }} />
            <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ textAlign: 'center' }}>
              {t('uploadDocument.upload.hint')}
            </MyazaText>
            <View style={{ height: spacing.md }} />
            {/* Stays in the layout while busy so the card keeps its height. */}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', opacity: p.busy ? 0 : 1 }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Icon name="upload" size={16} color={colors.primary} />
              <View style={{ width: spacing.xs }} />
              <MyazaText variant="label" color={colors.primary} style={{ fontWeight: '600' }}>
                {t('uploadDocument.upload.tapToChoose')}
              </MyazaText>
              <View style={{ width: 2 }} />
              <Icon name="chevron-right" size={16} color={colors.primary} />
            </View>
          </>
        )}
      </Pressable>

      <View style={{ height: spacing.md }} />
      {TIPS.map((tip) => (
        <View key={tip.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
          <Icon name={tip.icon} size={16} color={colors.textMuted} />
          <View style={{ width: spacing.sm }} />
          <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ flexShrink: 1 }}>
            {t(tip.key)}
          </MyazaText>
        </View>
      ))}
    </View>
  );
}
