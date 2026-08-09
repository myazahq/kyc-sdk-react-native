import React from 'react';
import { View } from 'react-native';

import { spacing } from '../../config/theme';
import { MyazaText } from '../../components/Typography';
import { MyazaButton } from '../../components/MyazaButton';
import { MrzScanView } from '../MrzScanView';
import type { MrzScan } from '../../mrz/parse';

/**
 * The second chance at the chip's key.
 *
 * Without an MRZ there is nothing to unlock the chip with, and this step used
 * to dead-end there — which made the chip unreachable whenever the document
 * photo happened to read badly. Scanning the strip live costs the user one
 * more aim of the camera and recovers the whole step.
 */
export function NfcMrzPrompt({
  onScanned,
  onSkip,
}: {
  onScanned: (scan: MrzScan) => void;
  /** Null hides the escape hatch (the flow set `allowSkip: false`). */
  onSkip: (() => void) | null;
}): React.ReactElement {
  return (
    <View>
      <MyazaText variant="bodyMedium">
        Point your camera at the photo page of your document. We’ll read the
        printed code that unlocks its chip.
      </MyazaText>
      <View style={{ height: spacing.md }} />
      <MrzScanView onScanned={onScanned} />
      <View style={{ height: spacing.md }} />
      {onSkip ? (
        <MyazaButton label="Continue without the chip" variant="ghost" onPress={onSkip} />
      ) : null}
    </View>
  );
}
