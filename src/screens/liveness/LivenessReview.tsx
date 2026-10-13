import React from 'react';
import { Image, View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { useText } from '../../i18n/useText';
import { UiText } from '../../components/Typography';
import { UiButton } from '../../components/UiButton';
import { UiPulseLoader } from '../../components/UiPulseLoader';
import { Icon } from '../../components/Icon';
import { PhotoBackdrop } from './Backdrop';
import { StyleAbsFill } from './constants';
import { ImmersiveFrame } from './ImmersiveFrame';
import { Panel, Pill } from './ImmersiveSurfaces';
import { SELFIE_DONE_BODY, SELFIE_DONE_TITLE } from './LivenessOutcome';
import type { SelfieUpload } from './useSelfieUpload';

// ---------------------------------------------------------------------------
// The review, full screen: the photo where the camera was, in the same window,
// so it reads as the camera held still rather than as a different screen.
//
// Only with a photo to show. A restored session has the uploaded media id and
// no local file, and keeps the sheet's own review (LivenessComplete).
// ---------------------------------------------------------------------------

/** The window's green edge on the review. */
const RIM = 4;

export function LivenessReview({
  selfieUri,
  soft: reportedSoft = false,
  upload,
  done = false,
  onRetake,
  onContinue,
}: {
  selfieUri: string;
  /** The still reads out of focus. A notice, never a gate. */
  soft?: boolean;
  upload: SelfieUpload;
  /** Taken on an earlier visit: shown as finished, with Continue and no Retake. */
  done?: boolean;
  onRetake: () => void;
  onContinue: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const t = useText();
  const soft = reportedSoft && !done;
  const { uploading, uploadError, retryInfo, selfieIdRef, videoPathRef, uploadSelfieAndVideo } = upload;
  const busy = uploading && !uploadError;

  const title = busy ? 'Saving your selfie…' : done ? SELFIE_DONE_TITLE : 'Selfie captured';
  const note = done
    ? SELFIE_DONE_BODY
    : soft
      ? 'This photo looks blurry. For the best chance of a match, retake it holding the phone steady until your face is sharp.'
      : null;

  return (
    <ImmersiveFrame
      // The photo twice: blurred behind, and sharp in the window.
      backdrop={() => <PhotoBackdrop uri={selfieUri} />}
      cutout={(window, frame) => (
        <View
          style={{
            width: window.width,
            height: window.height,
            borderRadius: window.width / 2,
            borderWidth: RIM,
            borderColor: colors.success,
            overflow: 'hidden',
            backgroundColor: '#111111',
          }}
        >
          {/* The photo is laid out as the camera was: covering the whole
              frame, and seen through the window. Fitted to the window alone it
              showed nearly the entire photo, with the face far smaller than it
              was when it was taken. Offsets are from inside the rim. */}
          <View style={[StyleAbsFill, { borderRadius: window.width / 2 - RIM, overflow: 'hidden' }]}>
            <Image
              source={{ uri: selfieUri }}
              resizeMode="cover"
              style={{
                position: 'absolute',
                left: -(window.x + RIM),
                top: -(window.y + RIM),
                width: frame.width,
                height: frame.height,
              }}
            />
          </View>
          {busy ? (
            <View style={[StyleAbsFill, { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }]}>
              <UiPulseLoader size={64} />
            </View>
          ) : null}
        </View>
      )}
      above={() => (
        <View style={{ alignItems: 'center' }}>
          <Pill>
            <Icon name="circle-check" size={18} color={colors.success} />
            <View style={{ width: 8 }} />
            <UiText variant="label" style={{ fontWeight: '600', flexShrink: 1 }}>
              {title}
            </UiText>
          </Pill>
        </View>
      )}
      footerReserve={92}
      footer={
        <Panel>
          {/* The line about the photo sits IN this panel, over the buttons,
              not in the space under the window. That space is whatever the
              window leaves, and on a shorter phone it was less than the line
              needs: the note was cut off above the buttons. One line at a
              time: a retry in progress, else the note. */}
          {retryInfo && uploading ? (
            <UiText variant="bodySmall" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
              {`Upload failed, retrying (${retryInfo.attempt}/${retryInfo.total})`}
            </UiText>
          ) : note ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              {soft ? <Icon name="alert" size={16} color={colors.textDark} /> : null}
              <UiText variant="bodySmall" style={{ textAlign: soft ? 'left' : 'center', flex: 1 }}>
                {note}
              </UiText>
            </View>
          ) : null}
          {uploadError ? (
            <UiButton
              label="Try Again"
              disabled={uploading}
              onPress={() => void uploadSelfieAndVideo(selfieUri, videoPathRef.current)}
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {done ? null : (
                <View style={{ flex: 1 }}>
                  <UiButton
                    label={t('common.retake')}
                    variant="outline"
                    leadingIcon="refresh"
                    disabled={uploading}
                    onPress={onRetake}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                {/* Disabled and quiet while the photo uploads, never spinning:
                    the one progress mark is in the window, where the work is. */}
                <UiButton
                  label={t('common.continue')}
                  disabled={uploading || !selfieIdRef.current}
                  onPress={onContinue}
                />
              </View>
            </View>
          )}
        </Panel>
      }
    />
  );
}
