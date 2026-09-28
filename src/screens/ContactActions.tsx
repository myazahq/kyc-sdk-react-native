import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { MyazaButton } from '../components/MyazaButton';
import { ContactFooterNote } from './ContactFooterNote';
import { useText } from '../i18n/useText';

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
  const t = useText();
  return (
    <>
      <View style={{ height: spacing.md }} />
      <MyazaButton
        label={hasChallenge ? t('contact.verifyCode') : t('contact.sendCode')}
        loading={busy}
        disabled={disabled}
        onPress={onPrimary}
      />

      {!required ? (
        <>
          <View style={{ height: spacing.sm }} />
          <MyazaButton label={t('contact.skip')} variant="ghost" disabled={busy} onPress={onSkip} />
        </>
      ) : null}

      <View style={{ height: spacing.md }} />
      <ContactFooterNote isEmail={isEmail} />
    </>
  );
}
