import React from 'react';
import { View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { NfcReadProgress } from './NfcReadProgress';
import { NfcScannedSummary } from './NfcScannedSummary';
import { NfcScanIllustration } from './NfcScanIllustration';
import type { NfcReadStage } from '../../emrtd';
import type { MrzScan } from '../../mrz/parse';

/**
 * The chip step's body: the document illustration, the read narration, and
 * what the MRZ scan found.
 *
 * The narration is the part that matters. iOS gets a system sheet describing
 * the read for free; Android gets nothing, so without this the same read is a
 * silent spinner — and silence is exactly what makes a user lift the document,
 * which aborts it.
 */
export function NfcReadBody({
  reading,
  stage,
  scan,
}: {
  reading: boolean;
  stage: NfcReadStage;
  scan: MrzScan;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <>
      <NfcScanIllustration />
      <View style={{ height: spacing.lg }} />

      {reading ? (
        <>
          <MyazaText variant="bodyMedium" style={{ textAlign: 'center' }}>
            {stage === 'waiting'
              ? 'Hold the top edge of your document flat against the back of your phone and keep still…'
              : 'Chip detected — keep the document still until this finishes.'}
          </MyazaText>
          <View style={{ height: spacing.md }} />
          <NfcReadProgress stage={stage} />
        </>
      ) : (
        <>
          <MyazaText variant="bodySmall" color={colors.textMuted} style={{ textAlign: 'center' }}>
            Hold the top edge of your document flat against the back of your
            phone and keep still…
          </MyazaText>
          {/* Shown BEFORE the read, so the wrong document is obvious now rather
              than after an opaque BAC failure. */}
          <View style={{ height: spacing.md }} />
          <View style={{ alignSelf: 'stretch' }}>
            <NfcScannedSummary scan={scan} />
          </View>
        </>
      )}
    </>
  );
}
