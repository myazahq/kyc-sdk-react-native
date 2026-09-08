import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { Icon } from '../components/Icon';
import { awaitVerificationOutcome, type VerificationOutcome } from '../lib/result-wait';
import { describeOutcome, describeWaiting } from '../lib/result-copy';
import { biometricCopyFor } from '../lib/biometric-copy';
import { configScope } from '../lib/scope';
import { Badge } from './SubmittedBadge';
import { SubmittedWaiting } from './SubmittedWaiting';
import { StaggerIn } from '../components/StaggerIn';

// ─── The result screen (a flow that waits for its verdict) ──────────────────
//
// A biometric re-authentication delivered in the flow ('both', the default, or 'app')
// is answered NOW or it is useless. This screen is mounted from the submitted
// step's FIRST render and shows one loading screen through the selfie upload,
// the submission (`verificationId` is null until it lands) and the status
// poll, then the verdict, firing `onResult` once. The wait has a budget: past
// it the screen says so and the webhook remains the record, exactly as on
// every other flow. `showDone` is the `doneButton` option: off when the host
// app dismisses the flow itself from `onResult`.

export function SubmittedResult({
  verificationId,
  retry,
  showDone,
  onClose,
}: {
  verificationId: string | null;
  retry: { attempt: number; total: number } | null;
  showDone: boolean;
  onClose: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const config = useKycConfig();
  const store = useKycStore();
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(null);

  useEffect(() => {
    if (!verificationId) return undefined;
    let alive = true;
    const api = store.getState().api;
    void awaitVerificationOutcome({
      fetchStatus: () => api.status(verificationId).catch(() => null),
    }).then((settled) => {
      if (!alive) return;
      setOutcome(settled);
      if (settled.kind === 'settled') {
        config.onResult?.({
          verificationId,
          status: settled.status,
          reason: settled.reason,
          reasonCode: settled.reasonCode,
        });
      }
    });
    return () => {
      alive = false;
    };
    // The wait is tied to the verification, not to the callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationId]);

  // The org's own words for these screens, tokens filled (null = the defaults).
  const words = biometricCopyFor(config);
  if (!outcome) {
    const copy = describeWaiting({ scope: configScope(config), waitsForResult: true, retry, override: words.waiting });
    return <SubmittedWaiting title={copy.title} description={copy.description} retrying={retry != null} />;
  }

  const copy = describeOutcome(outcome, words);
  const palette =
    copy.tone === 'success'
      ? { bg: colors.successBg, fg: colors.success, icon: 'check' as const }
      : copy.tone === 'error'
        ? { bg: colors.errorBg, fg: colors.error, icon: 'alert' as const }
        : { bg: `${colors.primary}14`, fg: colors.primary, icon: 'info' as const };

  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ height: spacing.xl }} />
        {/* The verdict lands in the order Flutter's does: badge, title,
            description, then Done (delays 0 / 200 / 320 / 600 ms). */}
        <StaggerIn>
          <Badge bg={palette.bg} border={`${palette.fg}4D`}>
            <Icon name={palette.icon} size={44} color={palette.fg} />
          </Badge>
        </StaggerIn>
        <View style={{ height: spacing.lg }} />
        <StaggerIn delayMs={200}>
          <MyazaText variant="heading1" style={{ textAlign: 'center' }}>
            {copy.title}
          </MyazaText>
        </StaggerIn>
        <View style={{ height: spacing.sm }} />
        <StaggerIn delayMs={320}>
          <MyazaText variant="bodyMedium" style={{ textAlign: 'center', paddingHorizontal: spacing.lg }}>
            {copy.description}
          </MyazaText>
        </StaggerIn>
      </View>
      {showDone ? (
        <StaggerIn delayMs={600}>
          <MyazaButton label="Done" onPress={onClose} />
        </StaggerIn>
      ) : (
        <View />
      )}
    </View>
  );
}
