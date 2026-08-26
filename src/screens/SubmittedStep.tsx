import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { mapToKycError, safeReportError } from '../services/errors';
import { contactStepFor, expiredContactChannels } from '../lib/contact-recovery';
import type { KYCError, KYCSubmission } from '../types/verification';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MyazaAlert } from '../components/MyazaAlert';
import { MyazaPulseLoader } from '../components/MyazaPulseLoader';
import { Icon } from '../components/Icon';
import { fillTokens } from '../utils/tokens';
import { KeepLinksSheet } from './KeepLinksSheet';
import { KeyPeopleAwaitList, rowsFromServer } from './KeyPeopleAwaitList';
import { KeyPeoplePending } from './KeyPeoplePending';
import { useAwaitingPeople } from './useAwaitingPeople';

// Terminal screen — 1:1 with the Flutter SDK's SubmittedScreen. Calls
// submitAsync on mount; renders submitting / success / error views with the same
// badges + copy. The header title is empty for this step.

type Phase = 'submitting' | 'success' | 'error';

const DEFAULT_SUCCESS_TITLE = 'Verification Submitted!';
// The default description depends on WHAT was submitted. A KYB applicant told
// "your identity verification has been submitted" is being told about the wrong
// thing: they submitted a company. Mirrors the web SDK's successDescription.
const defaultSuccessDescription = (isBusiness: boolean): string =>
  isBusiness
    ? "Your business verification has been submitted for review. You'll be notified of the result."
    : "Your identity verification has been submitted for review. You'll be notified of the result.";

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
  // The people list comes from the SERVER once registry discovery settles —
  // the submit-time invites are a first draft the register can contradict
  // (it adds people the applicant never listed, including ones they removed).
  const sessionId = useKyc((s) => s.sessionId);
  const settled = useAwaitingPeople(store.getState().api, sessionId, phase === 'success');
  const [error, setError] = useState<KYCError | null>(null);
  const [keepLinksOpen, setKeepLinksOpen] = useState(false);
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
        status: 'processing',
        metadata: config.metadata ?? {},
        submittedAt: new Date().toISOString(),
      };
      config.onSubmit?.(submission);
      setPhase('success');
    } catch (err) {
      // A refusal over stale contact proofs is recoverable in-flow: clear the
      // dead tokens and walk back to the contact step, which routes straight
      // back here once re-verified (see lib/contact-recovery.ts).
      const expired = expiredContactChannels(err);
      if (expired.length > 0) {
        store.getState().clearContactProofs(expired);
        store.getState().goToStep(contactStepFor(expired[0]!));
        return;
      }
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
    : defaultSuccessDescription(config.subjectType === 'business');
  // KYB: whether a people list is COMING (the submit minted invites). The list
  // itself renders from the server's reconciled view, never from this draft.
  const invitesExpected = store.getState().keyPeopleInvites.length > 0;

  // People still owing a check when the applicant leaves. The settled list is
  // authoritative once it arrives; before that, minted invites are the signal.
  const outstanding = settled
    ? settled.some((r) => r.status === 'pending' || r.status === 'failed')
    : invitesExpected;
  const sessionUrl = store.getState().sessionUrl;
  // Tapping Done with links still live: offer the web page those links live
  // on, because this screen dies with the app and the links die with it.
  // Workflow opt-out: `keyPeopleLinkRecovery: false` (on by default).
  const offerRecovery =
    outstanding && !!sessionUrl && config.keyPeopleLinkRecovery !== false;

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
        {settled
          ? settled.length > 0
            ? <KeyPeopleAwaitList rows={rowsFromServer(settled)} />
            : null
          : invitesExpected
            ? <KeyPeoplePending />
            : null}
      </View>
      <MyazaButton
        label="Done"
        onPress={() => (offerRecovery ? setKeepLinksOpen(true) : onClose())}
      />
      {offerRecovery ? (
        <KeepLinksSheet
          open={keepLinksOpen}
          url={sessionUrl!}
          onClose={() => setKeepLinksOpen(false)}
          onDone={() => {
            setKeepLinksOpen(false);
            onClose();
          }}
        />
      ) : null}
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
