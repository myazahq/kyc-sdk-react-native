import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { MyazaButton } from '../components/MyazaButton';
import { VerifiedNotice } from '../components/VerifiedNotice';
import { useText } from '../i18n/useText';

/**
 * Shown when the user returns to a contact step they already passed: the
 * confirmation card plus Continue. Mirrors the web SDK's verified branch and
 * Flutter's ContactVerifiedView.
 */
export function ContactVerifiedPanel({
  isEmail,
  destination,
  onContinue,
}: {
  isEmail: boolean;
  /** The verified address/number, when known — shown verbatim, like web. */
  destination?: string;
  onContinue: () => void;
}): React.ReactElement {
  const t = useText();
  return (
    <View>
      <VerifiedNotice
        label={
          destination
            ? `${destination} is verified.`
            : `Your ${isEmail ? 'email' : 'phone number'} is verified.`
        }
      />
      <View style={{ height: spacing.md }} />
      <MyazaButton label={t('common.continue')} onPress={onContinue} />
    </View>
  );
}
