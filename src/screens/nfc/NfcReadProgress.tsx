import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { NFC_STAGE_ORDER, nfcStageLabel, type NfcReadStage } from '../../emrtd';

// ---------------------------------------------------------------------------
// NFC read progress.
//
// iOS puts a system sheet over the screen for the whole chip read and narrates
// it. Android has NO system NFC UI whatsoever, so the same read is otherwise a
// bare spinner: the user cannot tell whether the chip has even been detected,
// let alone that three data groups are being pulled off it — and the natural
// response to that silence is to lift the document, which aborts the read.
//
// This draws the narration the platform does not. Same wording as the iOS
// sheet, so both platforms describe the read identically. Ported from the
// Flutter SDK's NfcReadProgress.
// ---------------------------------------------------------------------------

/**
 * The steps worth showing. `waiting` is NOT one of them — it is the state
 * before any step starts, and it gets its own prominent line above.
 */
const STEPS: NfcReadStage[] = [
  'authenticating',
  'readingData',
  'readingSecurity',
  'readingPhoto',
  'readingDetails',
];

export function NfcReadProgress({ stage }: { stage: NfcReadStage }): React.ReactElement {
  const { colors } = useTheme();

  // Waiting is the state users misread as "nothing is happening", so it says
  // what the phone is doing rather than leaving a silent spinner.
  if (stage === 'waiting') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={colors.primary} />
        <View style={{ width: 8 }} />
        <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '600' }}>
          {nfcStageLabel('waiting')}
        </MyazaText>
      </View>
    );
  }

  const currentIndex = NFC_STAGE_ORDER.indexOf(stage);

  return (
    <View style={{ alignSelf: 'stretch' }}>
      {STEPS.map((step) => {
        // `done` completes EVERY step: the photo group is skipped when the
        // security object didn't come back, and a step left spinning after a
        // successful read would read as a failure.
        const complete = stage === 'done' || currentIndex > NFC_STAGE_ORDER.indexOf(step);
        const active = stage === step;
        return (
          <View
            key={step}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}
          >
            <View style={{ width: 18, alignItems: 'center' }}>
              {complete ? (
                <Icon name="badge-check" size={16} color={colors.success} />
              ) : active ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.gray300,
                  }}
                />
              )}
            </View>
            <View style={{ width: 10 }} />
            <MyazaText
              variant="bodySmall"
              color={complete || active ? colors.textDark : colors.textMuted}
              style={{ fontWeight: active ? '600' : '400', flex: 1 }}
            >
              {nfcStageLabel(step)}
            </MyazaText>
          </View>
        );
      })}
    </View>
  );
}
