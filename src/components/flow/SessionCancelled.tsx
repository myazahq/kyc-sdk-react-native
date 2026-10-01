import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../runtime';
import { MyazaText } from '../Typography';
import { MyazaButton } from '../MyazaButton';
import { Icon } from '../Icon';
import { KycSheet } from '../KycSheet';
import { Badge } from '../../screens/SubmittedBadge';
import { CANCELLED_TITLE, DEFAULT_CANCELLED_MESSAGE } from '../../lib/session-cancelled';
import { safeReportError } from '../../services/errors';
import { KYCError } from '../../types/verification';

/**
 * Fire `onError` with `session_cancelled` ONCE, the first time the run is
 * marked cancelled, whichever call learned it (session start, a progress save,
 * the submission or the status poll).
 */
export function useReportCancellation(
  cancelled: { message: string } | null,
  onError: ((error: KYCError) => void) | undefined,
): void {
  const reportedRef = useRef(false);
  useEffect(() => {
    if (!cancelled || reportedRef.current) return;
    reportedRef.current = true;
    safeReportError(onError, new KYCError('session_cancelled', cancelled.message));
  }, [cancelled, onError]);
}

/**
 * The organisation (or Myaza support) cancelled this verification session.
 *
 * Terminal by design, like the submitted error screens: the server refuses to
 * reopen or restart a cancelled session until an admin uncancels it, so no
 * Try again is offered. The only action is Close. The org's brand bar stays,
 * since this is the org's verification and the person should know whose.
 * The consumer is told through `onError` (`session_cancelled`) by the flow.
 */
export function SessionCancelled({
  message,
  onClose,
}: {
  message?: string | null;
  onClose: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <KycSheet title="" onClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ height: spacing.xl }} />
          <Badge bg={colors.errorBg} border={`${colors.error}4D`}>
            <Icon name="circle-x" size={44} color={colors.error} />
          </Badge>
          <View style={{ height: spacing.lg }} />
          <MyazaText variant="heading1" style={{ textAlign: 'center' }} accessibilityRole="header">
            {CANCELLED_TITLE}
          </MyazaText>
          <View style={{ height: spacing.sm }} />
          <MyazaText
            variant="bodyMedium"
            color={colors.textSecondary}
            style={{ textAlign: 'center', paddingHorizontal: spacing.lg }}
          >
            {message || DEFAULT_CANCELLED_MESSAGE}
          </MyazaText>
        </View>
        <View style={{ paddingTop: spacing.lg }}>
          <MyazaButton label="Close" onPress={onClose} />
        </View>
      </View>
    </KycSheet>
  );
}
