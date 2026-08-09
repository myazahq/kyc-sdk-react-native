import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { MyazaButton } from '../components/MyazaButton';
import { VerifiedNotice } from '../components/VerifiedNotice';

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
      <MyazaButton label="Continue" onPress={onContinue} />
    </View>
  );
}
