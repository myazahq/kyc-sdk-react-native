import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { MyazaButton } from '../components/MyazaButton';
import { ContactFooterNote } from './ContactFooterNote';

// ---------------------------------------------------------------------------
// The contact step's footer: the one primary action (send, then verify), the
// optional skip, and the reassurance note. Split from ContactVerificationStep
// (200-line rule); the step owns every decision and this only renders them.
// ---------------------------------------------------------------------------

export function ContactActions({
  hasChallenge,
  busy,
  disabled,
  required,
  isEmail,
  onPrimary,
  onSkip,
}: {
  /** A code is out: the button verifies instead of sending. */
  hasChallenge: boolean;
  busy: boolean;
  disabled: boolean;
  /** `required: false` adds the skip; the server enforces the rest. */
  required: boolean;
  isEmail: boolean;
  onPrimary: () => void;
  onSkip: () => void;
}): React.ReactElement {
  return (
    <>
      <View style={{ height: spacing.md }} />
      <MyazaButton
        label={hasChallenge ? 'Verify code' : 'Send code'}
        loading={busy}
        disabled={disabled}
        onPress={onPrimary}
      />

      {!required ? (
        <>
          <View style={{ height: spacing.sm }} />
          <MyazaButton label="Skip for now" variant="ghost" disabled={busy} onPress={onSkip} />
        </>
      ) : null}

      <View style={{ height: spacing.md }} />
      <ContactFooterNote isEmail={isEmail} />
    </>
  );
}
