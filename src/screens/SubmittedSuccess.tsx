import React, { useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { Icon } from '../components/Icon';
import { fillTokens } from '../utils/tokens';
import { configScope } from '../lib/scope';
import { KeepLinksSheet } from './KeepLinksSheet';
import { KeyPeopleAwaitList, rowsFromServer } from './KeyPeopleAwaitList';
import { PresenceExpectations } from '../components/PresenceBlocks';
import { StaggerIn } from '../components/StaggerIn';
import { KeyPeoplePending } from './KeyPeoplePending';
import { useAwaitingPeople } from './useAwaitingPeople';
import { Badge } from './SubmittedBadge';

// The submitted step's success screen (split from SubmittedStep, 200-line
// rule): the org's success copy, the presence expectations, the KYB key
// people still owing a check, and Done. `showDone` is the biometric scopes'
// `doneButton` option: off when the host app closes the flow itself.

const DEFAULT_SUCCESS_TITLE = 'Verification Submitted!';
// The default description depends on WHAT was submitted. A KYB applicant told
// "your identity verification has been submitted" is being told about the wrong
// thing: they submitted a company, and an address-only applicant submitted a
// pin. Mirrors the web SDK's successDescription (scope map included).
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  address: "Your address verification has been submitted. You'll be notified of the result.",
  'biometric-authentication': "Your face check has been submitted. You'll be notified of the result.",
  'biometric-enrollment': "Your selfie is saved as the reference for your future face checks.",
  questionnaire: "Your answers have been submitted. You'll be notified of the result.",
  contact: "Your contact verification has been submitted. You'll be notified of the result.",
};
const defaultSuccessDescription = (isBusiness: boolean, scope: string | null): string => {
  if (scope && SCOPE_DESCRIPTIONS[scope]) return SCOPE_DESCRIPTIONS[scope]!;
  return isBusiness
    ? "Your business verification has been submitted for review. You'll be notified of the result."
    : "Your identity verification has been submitted for review. You'll be notified of the result.";
};

export function SubmittedSuccess({ showDone, onClose }: { showDone: boolean; onClose: () => void }): React.ReactElement {
  const { colors } = useTheme();
  const config = useKycConfig();
  const store = useKycStore();
  // The people list comes from the SERVER once registry discovery settles —
  // the submit-time invites are a first draft the register can contradict
  // (it adds people the applicant never listed, including ones they removed).
  const sessionId = useKyc((s) => s.sessionId);
  const settled = useAwaitingPeople(store.getState().api, sessionId, true);
  const [keepLinksOpen, setKeepLinksOpen] = useState(false);

  const title = config.success?.title ? fillTokens(config.success.title, config.userData) : DEFAULT_SUCCESS_TITLE;
  const description = config.success?.description
    ? fillTokens(config.success.description, config.userData)
    : defaultSuccessDescription(config.subjectType === 'business', configScope(config));
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
  const offerRecovery = outstanding && !!sessionUrl && config.keyPeopleLinkRecovery !== false;

  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ height: spacing.xl }} />
        {/* Lands in the order Flutter's success view does: badge, title,
            description, then Done (delays 0 / 200 / 320 / 600 ms). */}
        <StaggerIn>
          <Badge bg={colors.successBg} border={`${colors.success}4D`}>
            <Icon name="check" size={44} color={colors.success} />
          </Badge>
        </StaggerIn>
        <View style={{ height: spacing.lg }} />
        <StaggerIn delayMs={200}>
          <MyazaText variant="heading1" style={{ textAlign: 'center' }}>
            {title}
          </MyazaText>
        </StaggerIn>
        <View style={{ height: spacing.sm }} />
        <StaggerIn delayMs={320}>
          <MyazaText variant="bodyMedium" style={{ textAlign: 'center' }}>
            {description}
          </MyazaText>
        </StaggerIn>
        {config.addressCollection?.presence?.enabled === true && store.getState().address ? (
          <PresenceExpectations />
        ) : null}
        {settled
          ? settled.length > 0
            ? <KeyPeopleAwaitList rows={rowsFromServer(settled)} />
            : null
          : invitesExpected
            ? <KeyPeoplePending />
            : null}
      </View>
      {showDone ? (
        <StaggerIn delayMs={600}>
          <MyazaButton label="Done" onPress={() => (offerRecovery ? setKeepLinksOpen(true) : onClose())} />
        </StaggerIn>
      ) : (
        <View />
      )}
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
