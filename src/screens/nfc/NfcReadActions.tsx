import React from 'react';
import { View } from 'react-native';

import { spacing } from '../../config/theme';
import { MyazaButton } from '../../components/MyazaButton';
import { useText } from '../../i18n/useText';
import type { NfcReadStage } from '../../emrtd';

/**
 * The chip step's actions under the read: the retry once a read has failed,
 * and the skip once it has been earned. Split from NfcStep (200-line rule).
 */
export function NfcReadActions({
  phase,
  stage,
  showSkip,
  onRetry,
  onSkip,
}: {
  phase: string;
  stage: NfcReadStage;
  /** The flow allows skipping and the skip has been revealed. */
  showSkip: boolean;
  onRetry: () => void;
  onSkip: () => void;
}): React.ReactElement {
  const t = useText();
  return (
    <View style={{ alignSelf: 'stretch' }}>
      {/* No "Scan chip" button: the read starts on arrival (like Flutter),
          so a button naming an action already underway only invites a tap
          that restarts it. The retry appears only once there is something to
          retry. */}
      {phase === 'failed' ? (
        <MyazaButton label="Try scanning the chip again" onPress={onRetry} />
      ) : null}
      {/* Attempt-first: hidden until a failed read (or the reveal timer)
          earns it — see SKIP_REVEAL_MS. Opt-IN, matching Flutter
          (`allowSkip: json['allowSkip'] ?? false`): an absent flag shows no
          skip, because that is what the server sends unless an org turns it
          on. Once revealed it stays tappable even mid-read while the reader
          is still WAITING for a tag — that wait can be endless on Android,
          and leaving cancels the session (the unmount cleanup) — but not
          once a chip is actually transferring, where a tap would rip up a
          read that is about to succeed. */}
      {showSkip ? (
        <>
          {phase === 'failed' ? <View style={{ height: spacing.sm }} /> : null}
          <MyazaButton
            label={t('nfc.skip')}
            variant="ghost"
            disabled={phase === 'reading' && stage !== 'waiting'}
            onPress={onSkip}
          />
        </>
      ) : null}
    </View>
  );
}
