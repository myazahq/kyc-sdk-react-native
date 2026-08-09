import React from 'react';
import { View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { MyazaButton } from '../../components/MyazaButton';
import { SelfiePreview } from './SelfiePreview';
import type { SelfieUpload } from './useSelfieUpload';
import type { LivenessFailureReason } from '../../liveness/types';

// ---------------------------------------------------------------------------
// The two ways the liveness step ends.
//
// COMPLETE is not "done": the selfie is uploading behind the preview, so
// Continue stays disabled until the media id exists. A failed upload keeps the
// captured selfie and offers a retry rather than sending the user back through
// the whole check for a network blip.
//
// FAILED mirrors the Flutter failed view — a centred red line and a full-width
// "Try Again", no icon.
// ---------------------------------------------------------------------------

export function LivenessComplete({
  selfieUri,
  upload,
  onRetake,
  onContinue,
}: {
  selfieUri: string;
  upload: SelfieUpload;
  onRetake: () => void;
  onContinue: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const { uploading, uploadError, retryInfo, selfieIdRef, videoPathRef, uploadSelfieAndVideo } =
    upload;
  return (
      <View>
        <SelfiePreview uri={selfieUri} uploading={uploading && !uploadError} />
        {retryInfo && uploading ? (
          <MyazaText variant="bodySmall" color={colors.warning} style={{ textAlign: 'center', marginTop: spacing.sm }}>
            {`Upload failed — retrying (${retryInfo.attempt}/${retryInfo.total})…`}
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
            onPress={() => void uploadSelfieAndVideo(selfieUri, videoPathRef.current)}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <MyazaButton
                label="Retake"
                variant="outline"
                leadingIcon="refresh"
                disabled={uploading}
                onPress={onRetake}
              />
            </View>
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
                label="Continue"
                disabled={uploading || !selfieIdRef.current}
                onPress={onContinue}
              />
            </View>
          </View>
        )}
      </View>
  );
}

export function LivenessFailed({
  reason,
  onRetry,
}: {
  reason: LivenessFailureReason | null;
  onRetry: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.lg }}>
        <MyazaText variant="bodyMedium" color={colors.error} style={{ textAlign: 'center', fontWeight: '500' }}>
          {reason === 'timeout'
            ? "Time's up. Let's try again."
            : 'Face lost. Please try again.'}
        </MyazaText>
        <View style={{ alignSelf: 'stretch' }}>
          <MyazaButton label="Try Again" onPress={onRetry} />
        </View>
      </View>
  );
}
