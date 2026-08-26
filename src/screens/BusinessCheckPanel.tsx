import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaAlert } from '../components/MyazaAlert';
import type { BusinessCheckState } from '../store/state';

// ---------------------------------------------------------------------------
// What the register said, when it was NOT a plain yes.
//
// The check is a paid, deliberate step, so it is shown rather than run
// invisibly: the applicant sees a company that is not on the register caught
// HERE instead of after documents and a selfie. Nothing is shown for a company
// that WAS found — the register's answer is already in the form the applicant
// is looking at, editable, and its officers are the next step. Mirrors the web
// SDK's BusinessCheckPanel.
// ---------------------------------------------------------------------------

export function BusinessCheckPanel({
  check,
}: {
  check: BusinessCheckState;
}): React.ReactElement | null {
  // `skipped` shows nothing on purpose. The organisation could not be charged,
  // which is not the applicant's problem and not something they can act on;
  // the check simply happens at submission instead. `checking` shows nothing
  // either — the loader lives inside the Continue button they just pressed.
  if (
    check.status === 'idle' ||
    check.status === 'skipped' ||
    check.status === 'found' ||
    check.status === 'checking'
  ) {
    return null;
  }

  if (check.status === 'not_found') {
    return (
      <MyazaAlert
        variant="warning"
        title="We could not find this business on the register"
        message="Check the registration number and try again."
      />
    );
  }

  if (check.status === 'limit_reached') {
    // Not a failure: the submission still runs its own check. What it says is
    // "stop re-picking and look at the number", which is the only thing left
    // that helps.
    return (
      <NeutralPanel
        title="We have stopped looking this up for now"
        body="This application has searched the register several times. Check the registration number is right; your details will still be verified when you submit."
      />
    );
  }

  // unavailable — deliberately not "we could not find it": an outage is not
  // evidence that a business is unregistered.
  return (
    <NeutralPanel
      title="The register is temporarily unavailable"
      body="You can continue, and we will check it shortly."
    />
  );
}

function NeutralPanel({ title, body }: { title: string; body: string }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        backgroundColor: colors.backgroundSecondary,
        padding: spacing.md,
      }}
    >
      <MyazaText variant="label">{title}</MyazaText>
      <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 2 }}>
        {body}
      </MyazaText>
    </View>
  );
}
