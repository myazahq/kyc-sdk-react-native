import React from 'react';
import { View } from 'react-native';

import { spacing } from '../../config/theme';
import { MyazaAlert } from '../../components/MyazaAlert';
import { MyazaButton } from '../../components/MyazaButton';
import { documentReviewCopy } from '../../components/documentReviewCopy';
import {
  CAPTURE_CHECK_CONTINUE_ANYWAY,
  CAPTURE_CHECK_TITLE,
  captureProblemMessage,
  captureRetakeLabel,
  captureRetakeSides,
  type CaptureProblem,
} from '../../lib/documentCaptureCheck';
import type { DocumentCaptureSide } from '../../services/api-types';

// ─── The review footer when a document photo will not read ───────────────────
//
// Shown in place of Continue after the server's capture check found no face on
// the printed photo or no readable barcode (lib/documentCaptureCheck). The
// words come from that module so they stay in lockstep with the web and
// Flutter SDKs.
//
// A notice, never a gate: the detectors can miss, so "Continue anyway" is
// always offered and moves on with the photos already uploaded. The first
// retake is the primary action because a retake is the likelier fix.

export function CaptureCheckNotice({
  problems,
  uploadOnly,
  onRetake,
  onContinueAnyway,
}: {
  problems: readonly CaptureProblem[];
  /** The sides were picked from the device, so they are replaced, not retaken. */
  uploadOnly: boolean;
  onRetake: (side: DocumentCaptureSide) => void;
  onContinueAnyway: () => void;
}): React.ReactElement {
  // Once per kind: two sides with the same problem need one sentence, not two.
  const messages = [...new Set(problems.map((p) => captureProblemMessage(p.kind)))];
  const sides = captureRetakeSides(problems);
  const copy = documentReviewCopy(uploadOnly ? 'upload' : 'scan', true);

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Grouped and announced: the notice replaces the button the applicant
          just pressed, so a screen reader has to say why nothing moved on. */}
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${CAPTURE_CHECK_TITLE}. ${messages.join(' ')}`}
      >
        <MyazaAlert variant="warning" title={CAPTURE_CHECK_TITLE} message={messages.join('\n\n')} />
      </View>
      {sides.map((side, i) => (
        <MyazaButton
          key={side}
          label={captureRetakeLabel(side, uploadOnly)}
          variant={i === 0 ? 'primary' : 'outline'}
          leadingIcon="refresh"
          accessibilityLabel={copy.redoAccessibility(side === 'front' ? 'Front' : 'Back')}
          onPress={() => onRetake(side)}
        />
      ))}
      <MyazaButton
        label={CAPTURE_CHECK_CONTINUE_ANYWAY}
        variant="outline"
        accessibilityLabel={CAPTURE_CHECK_CONTINUE_ANYWAY}
        accessibilityHint="Carries on with these photos as they are"
        onPress={onContinueAnyway}
      />
    </View>
  );
}
