import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { MyazaAlert } from '../components/MyazaAlert';
import { ContactDestinationField } from './ContactDestinationField';
import { ContactChannelChoice } from './ContactChannelChoice';
import type { PhoneOtpChannel } from '../config/contact';

// ---------------------------------------------------------------------------
// The first half of the contact step: where to send the code, and (when the
// workflow offers a choice) how. Composed as one widget so the step has a
// single child per phase. Split from ContactVerificationStep (200-line rule);
// mirrors Flutter's ContactEntryPanel.
// ---------------------------------------------------------------------------

export function ContactEntryPanel({
  isEmail,
  recovery,
  email,
  onEmailChange,
  onPhoneChange,
  defaultCountry,
  geoCountry,
  error,
  disabled,
  offeredChannels,
  via,
  onPickChannel,
}: {
  isEmail: boolean;
  /** Entered via submit recovery: the server refused this channel's proof. */
  recovery: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: { e164: string; isValid: boolean }) => void;
  defaultCountry?: string;
  geoCountry?: string | null;
  error: string | null;
  disabled: boolean;
  offeredChannels: PhoneOtpChannel[];
  via: PhoneOtpChannel;
  onPickChannel: (channel: PhoneOtpChannel) => void;
}): React.ReactElement {
  return (
    <>
      {recovery && (
        <>
          <MyazaAlert
            variant="warning"
            title="Please verify again"
            message={`Your earlier confirmation has expired, so please verify ${isEmail ? 'your email' : 'your number'} once more. Everything else is saved, and we will submit again straight after.`}
          />
          <View style={{ height: spacing.md }} />
        </>
      )}
      <ContactDestinationField
        isEmail={isEmail}
        email={email}
        onEmailChange={onEmailChange}
        onPhoneChange={onPhoneChange}
        defaultCountry={defaultCountry}
        geoCountry={geoCountry}
        error={error}
        disabled={disabled}
      />
      <ContactChannelChoice
        offered={offeredChannels}
        picked={via}
        disabled={disabled}
        onPick={onPickChannel}
      />
    </>
  );
}
