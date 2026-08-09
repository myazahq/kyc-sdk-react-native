import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { mapToKycError, safeReportError } from '../services/errors';
import type { KYCError, KYCSubmission } from '../types/verification';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MyazaAlert } from '../components/MyazaAlert';
import { MyazaPulseLoader } from '../components/MyazaPulseLoader';
import { Icon } from '../components/Icon';
import { fillTokens } from '../utils/tokens';
import { KeyPeopleInviteLinks } from './KeyPeopleInviteLinks';

// Terminal screen — 1:1 with the Flutter SDK's SubmittedScreen. Calls
// submitAsync on mount; renders submitting / success / error views with the same
// badges + copy. The header title is empty for this step.

type Phase = 'submitting' | 'success' | 'error';

const DEFAULT_SUCCESS_TITLE = 'Verification Submitted!';
const DEFAULT_SUCCESS_DESCRIPTION =
  "Your identity verification has been submitted for review. You'll be notified of the result.";

const ERROR_TITLES: Record<string, string> = {
  insufficient_credits: 'Credits Exhausted',
  invalid_api_key: 'Authentication Failed',
  feature_disabled: 'Verification Unavailable',
  upload_failed: 'Upload Failed',
  network_error: 'Connection Failed',
};

export function SubmittedStep({ onClose }: { onClose: () => void }): React.ReactElement {
  const { colors } = useTheme();
  const config = useKycConfig();
  const store = useKycStore();
  const existingResult = useKyc((s) => s.submissionResult);

  const [phase, setPhase] = useState<Phase>('submitting');
  const [error, setError] = useState<KYCError | null>(null);
  const [retry, setRetry] = useState<{ attempt: number; total: number } | null>(null);
  const reportedRef = useRef(false);
  const kickedRef = useRef(false);

  const submit = React.useCallback(async () => {
    setPhase('submitting');
    setError(null);
    setRetry(null);
    try {
      const result = await store.getState().submitAsync((attempt, total) => setRetry({ attempt, total }));
      const submission: KYCSubmission = {
        verificationId: result.verificationId,
        status: 'pending',
        metadata: config.metadata ?? {},
        submittedAt: new Date().toISOString(),
      };
      config.onSubmit?.(submission);
      setPhase('success');
    } catch (err) {
      const kycError = mapToKycError(err, 'verify');
      setError(kycError);
      if (!reportedRef.current) {
        reportedRef.current = true;
        safeReportError(config.onError, kycError);
      }
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, config]);

  useEffect(() => {
    if (existingResult) {
      setPhase('success');
      return;
    }
    if (!kickedRef.current) {
      kickedRef.current = true;
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'submitting') {
    const retrying = retry != null;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl }}>
        <MyazaPulseLoader />
        <View style={{ height: spacing.lg }} />
        <MyazaText variant="heading3" style={{ textAlign: 'center' }}>
          {retrying ? 'Reconnecting…' : 'Submitting your verification…'}
        </MyazaText>
        <View style={{ height: spacing.sm }} />
        <MyazaText variant="bodyMedium" style={{ textAlign: 'center' }}>
          {retrying ? `Connection issue — retrying (${retry!.attempt}/${retry!.total})…` : 'Please wait a moment.'}
        </MyazaText>
      </View>
    );
  }

  if (phase === 'error' && error) {
    const title = ERROR_TITLES[error.code] ?? 'Submission Failed';
    const canRetry = error.code === 'network_error';
    return (
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ height: spacing.xl }} />
          <Badge bg={colors.errorBg} border={`${colors.error}4D`}>
            <Icon name="alert" size={44} color={colors.error} />
          </Badge>
          <View style={{ height: spacing.lg }} />
          <MyazaText variant="heading1" style={{ textAlign: 'center' }}>
            {title}
          </MyazaText>
          <View style={{ height: spacing.md }} />
          <View style={{ width: '100%', paddingHorizontal: spacing.md }}>
            <MyazaAlert variant="error" title="What happened" message={error.message} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {canRetry ? (
            <View style={{ flex: 1 }}>
              <MyazaButton label="Try Again" variant="outline" leadingIcon="refresh" onPress={() => void submit()} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <MyazaButton label="Close" onPress={onClose} />
          </View>
        </View>
      </View>
    );
  }

  // success
  const title = config.success?.title ? fillTokens(config.success.title, config.userData) : DEFAULT_SUCCESS_TITLE;
  const description = config.success?.description
    ? fillTokens(config.success.description, config.userData)
    : DEFAULT_SUCCESS_DESCRIPTION;
  // KYB: per-person verification links for full-KYC key people — rendered so
  // the applicant can send each one immediately.
  const invites = store.getState().keyPeopleInvites; // set before phase flips to success

  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ height: spacing.xl }} />
        <Badge bg={colors.successBg} border={`${colors.success}4D`}>
          <Icon name="check" size={44} color={colors.success} />
        </Badge>
        <View style={{ height: spacing.lg }} />
        <MyazaText variant="heading1" style={{ textAlign: 'center' }}>
          {title}
        </MyazaText>
        <View style={{ height: spacing.sm }} />
        <MyazaText variant="bodyMedium" style={{ textAlign: 'center' }}>
          {description}
        </MyazaText>
        <KeyPeopleInviteLinks invites={invites} />
      </View>
      <MyazaButton label="Done" onPress={onClose} />
    </View>
  );
}

function Badge({ bg, border, children }: { bg: string; border: string; children: React.ReactNode }): React.ReactElement {
  return (
    <View
      style={{
        width: 88,
        height: 88,
        borderRadius: radius.full,
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}
