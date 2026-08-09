import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useEffectiveCountry, useKyc, useKycConfig, useKycStore } from '../components/runtime';
import { MyazaButton } from '../components/MyazaButton';
import { ContactDestinationField } from './ContactDestinationField';
import { ContactVerifiedPanel } from './ContactVerifiedPanel';
import { ContactCodeStep } from './ContactCodeStep';
import { ContactChannelChoice } from './ContactChannelChoice';
import { ContactFooterNote } from './ContactFooterNote';
import {
  contactCodeLength,
  contactIsRequired,
  isValidContactEmail,
  offeredPhoneChannels,
  type PhoneOtpChannel,
} from '../config/contact';
import { attemptsRemaining, describeCheckError, describeSendError } from '../services/contactErrors';

// ---------------------------------------------------------------------------
// Contact-verification OTP step — email or phone, one component, two mounts.
//
//   enter destination → send → code entry → verified → continue
//
// The proof token is single-use and rides the /verify submission. The server
// enforces whether it was required; the `required: false` skip here is UX, and
// a skipped optional check simply submits without the proof.
// ---------------------------------------------------------------------------

export function ContactVerificationStep({
  channel,
}: {
  channel: 'email' | 'phone';
}): React.ReactElement {
  const config = useKycConfig();
  const country = useEffectiveCountry();
  const store = useKycStore();
  const contact = useKyc((s) => s.contact);

  const isEmail = channel === 'email';
  const stepConfig = isEmail ? config.emailVerification : config.phoneVerification;
  const required = contactIsRequired(stepConfig);
  const codeLength = contactCodeLength(stepConfig);
  const inputStyle = stepConfig?.inputStyle ?? 'segmented';
  // The org decides which channels are on offer; the user picks between them.
  const offeredChannels: PhoneOtpChannel[] = isEmail
    ? []
    : offeredPhoneChannels(config.phoneVerification?.channels);
  const [via, setVia] = useState<PhoneOtpChannel>(offeredChannels[0] ?? 'sms');

  const alreadyVerified = isEmail ? contact.emailToken != null : contact.phoneToken != null;

  const [destination, setDestination] = useState(contact.emailAddress ?? '');
  // The phone field emits E.164 + validity from libphonenumber, so the step no
  // longer guesses either from raw text.
  const [phone, setPhone] = useState<{ e164: string; isValid: boolean }>({
    e164: contact.phoneNumber ?? '',
    isValid: false,
  });
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | undefined>(undefined);
  const otherChannel = offeredChannels.find((c) => c !== via) ?? null;

  const value = isEmail ? destination.trim() : phone.e164;
  const canSend = isEmail ? isValidContactEmail(value) : phone.isValid;

  const advance = useCallback(() => store.getState().nextStep(), [store]);

  // The sheet header is rendered by the shell and cannot see this step's state,
  // so publish what it needs to caption: the channel in play now, and the
  // destination once a code is actually out. Re-published when the user picks a
  // different delivery channel so the header's "by WhatsApp" follows the choice.
  useEffect(() => {
    store.getState().setContactChallenge({
      channel,
      ...(isEmail ? {} : { via }),
      ...(challengeId ? { destination: value } : {}),
    });
  }, [store, channel, isEmail, via, challengeId, value]);

  /** `switchTo` re-sends over the other channel when the first one didn't land. */
  const send = async (switchTo?: PhoneOtpChannel): Promise<void> => {
    const sendVia = switchTo ?? via;
    if (switchTo) setVia(switchTo);
    setBusy(true);
    setError(null);
    setAttemptsLeft(undefined);
    try {
      const res = await store.getState().api.contactSend({
        channel,
        destination: value,
        codeLength,
        ...(stepConfig?.maxAttempts != null ? { maxAttempts: stepConfig.maxAttempts } : {}),
        ...(!isEmail && country ? { country } : {}),
        ...(isEmail ? {} : { via: sendVia }),
      });
      // Remember what was typed BEFORE the code lands: a user who backs out
      // here and returns should not have to retype it.
      store.getState().setContactDestination(channel, value);
      setChallengeId(res.challengeId);
      setExpiresAt(res.expiresAt ?? null);
      setCode('');
    } catch (err) {
      setError(describeSendError(err));
    } finally {
      setBusy(false);
    }
  };

  const check = async (submitted: string): Promise<void> => {
    if (!challengeId || submitted.length !== codeLength) return;
    setBusy(true);
    setError(null);
    try {
      const res = await store.getState().api.contactCheck({ challengeId, code: submitted });
      store.getState().setContactVerified(channel, value, res.token);
      advance();
    } catch (err) {
      setError(describeCheckError(err));
      setAttemptsLeft(attemptsRemaining(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  // Returning to a step already passed — nothing left to do here.
  if (alreadyVerified) {
    return (
      <ContactVerifiedPanel
        isEmail={isEmail}
        destination={isEmail ? contact.emailAddress : contact.phoneNumber}
        onContinue={advance}
      />
    );
  }

  // One frame for both halves, like web: the panel swaps, the actions stay put.
  return (
    <View>
      {challengeId ? (
        <ContactCodeStep
          codeLength={codeLength}
          inputStyle={inputStyle}
          code={code}
          busy={busy}
          error={error}
          attemptsLeft={attemptsLeft}
          expiresAt={expiresAt}
          otherChannel={otherChannel}
          onChange={setCode}
          onCheck={(full) => void check(full)}
          onResend={(switchTo) => void send(switchTo)}
        />
      ) : (
        <>
          <ContactDestinationField
            isEmail={isEmail}
            email={destination}
            onEmailChange={setDestination}
            onPhoneChange={setPhone}
            defaultCountry={config.phoneVerification?.defaultCountry ?? country ?? undefined}
            error={error}
            disabled={busy}
          />
          <ContactChannelChoice
            offered={offeredChannels}
            picked={via}
            disabled={busy}
            onPick={setVia}
          />
        </>
      )}

      <View style={{ height: spacing.md }} />
      <MyazaButton
        label={challengeId ? 'Verify code' : 'Send code'}
        loading={busy}
        disabled={challengeId ? code.length !== codeLength : !canSend}
        onPress={() => (challengeId ? void check(code) : void send())}
      />

      {!required ? (
        <>
          <View style={{ height: spacing.sm }} />
          <MyazaButton label="Skip for now" variant="ghost" disabled={busy} onPress={advance} />
        </>
      ) : null}

      <View style={{ height: spacing.md }} />
      <ContactFooterNote isEmail={isEmail} />
    </View>
  );
}
