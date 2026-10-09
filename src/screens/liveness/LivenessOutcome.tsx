import React from 'react';
import { View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { useText } from '../../i18n/useText';
import { MyazaText } from '../../components/Typography';
import { MyazaButton } from '../../components/MyazaButton';
import { SelfiePreview } from './SelfiePreview';
import type { SelfieUpload } from './useSelfieUpload';
import type { LivenessFailureReason } from '../../liveness/types';

// ---------------------------------------------------------------------------
// How the liveness step ends, in the sheet.
//
// COMPLETE is not "done": the selfie is uploading behind the preview, so
// Continue stays disabled until the media id exists. A failed upload keeps the
// captured selfie and offers a retry rather than sending the user back through
// the whole check for a network blip.
//
// A FAILED check is not an ending and has no screen here: it stays on the
// camera, with its reason and Try Again under the window (LivenessLive).
// ---------------------------------------------------------------------------

/** The finished step, when the person comes back to it. The same wording as
 *  the web and Flutter SDKs. */
export const SELFIE_DONE_TITLE = 'Selfie already taken';
export const SELFIE_DONE_BODY = 'You have completed this step. There is nothing more to do here.';

export function LivenessComplete({
  selfieUri,
  soft: reportedSoft = false,
  upload,
  done = false,
  onRetake,
  onContinue,
}: {
  /** Taken on an earlier visit to this step: shown as finished, with Continue
   *  and no Retake, so the check runs once per session. */
  done?: boolean;
  /** Null on a restored session: the mediaId survived, the local file did not. */
  selfieUri: string | null;
  /** The still reads out of focus. A notice on the preview, never a gate. */
  soft?: boolean;
  upload: SelfieUpload;
  onRetake: () => void;
  onContinue: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const t = useText();
  // A finished step offers no retake, so it gives no advice to take one.
  const soft = reportedSoft && !done;
  const { uploading, uploadError, retryInfo, selfieIdRef, videoPathRef, uploadSelfieAndVideo } =
    upload;
  return (
      <View>
        <SelfiePreview uri={selfieUri} uploading={uploading && !uploadError} soft={soft} />
        {done ? (
          <View style={{ marginTop: spacing.md, gap: 4 }}>
            <MyazaText variant="label" style={{ textAlign: 'center', fontWeight: '600' }}>
              {SELFIE_DONE_TITLE}
            </MyazaText>
            <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ textAlign: 'center' }}>
              {SELFIE_DONE_BODY}
            </MyazaText>
          </View>
        ) : null}
        {retryInfo && uploading ? (
          <MyazaText variant="bodySmall" color={colors.warning} style={{ textAlign: 'center', marginTop: spacing.sm }}>
            {`Upload failed, retrying (${retryInfo.attempt}/${retryInfo.total})`}
          </MyazaText>
        ) : null}
        <View style={{ height: spacing.md }} />
        {uploadError ? (
          // The error message itself is shown as a top toast; keep a retry action.
          <MyazaButton
            label="Try Again"
            // Disabled while the retry is in flight, not spinning — the progress
            // indicator belongs in the selfie frame, where the work is.
            disabled={uploading}
            onPress={() => selfieUri && void uploadSelfieAndVideo(selfieUri, videoPathRef.current)}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {done ? null : (
              <View style={{ flex: 1 }}>
                <MyazaButton
                  label={t('common.retake')}
                  variant="outline"
                  leadingIcon="refresh"
                  disabled={uploading}
                  onPress={onRetake}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              {/* No spinner on Continue, deliberately — 1:1 with Flutter.
              
                  There is already ONE progress indicator on this screen, inside
                  the selfie frame, and it is the truthful place for it: what is
                  loading is the photo, not the button. A second spinner on the
                  action implies the tap did something, when in fact the upload
                  started the moment the selfie appeared and the button has been
                  disabled since. Disabled-and-quiet says "not yet"; a spinner
                  says "working on your request", which would be a lie. */}
              <MyazaButton
                label={t('common.continue')}
                disabled={uploading || !selfieIdRef.current}
                onPress={onContinue}
              />
            </View>
          </View>
        )}
      </View>
  );
}

/** Why a check stopped, in the person's words. */
export function livenessFailureMessage(reason: LivenessFailureReason | null): string {
  if (reason === 'timeout') return "Time's up. Let's try again.";
  if (reason === 'flash_failed') return "We couldn't confirm the check. Let's try again.";
  return 'Face lost. Please try again.';
}
