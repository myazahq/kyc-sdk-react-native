import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { BusinessDocumentSlot } from './BusinessDocumentSlot';
import {
  DocumentMarker,
  DocumentReads,
  DocumentStatePill,
} from './supportingDocumentParts';

// ---------------------------------------------------------------------------
// One requested supporting document: what it is, what it is being taken FOR,
// and the upload that satisfies it.
//
// The middle part is the point. A supporting document is whatever the
// organisation named it, so an upload slot with a title on it tells the
// applicant almost nothing; naming the values that will be read off it says
// what the document is actually for, and is the honest thing to show somebody
// before they hand over a bank statement.
//
// MIRRORS the web SDK's SupportingDocumentCard and the Flutter one. Keep the
// three in step.
// ---------------------------------------------------------------------------

export function SupportingDocumentCard({
  position,
  total,
  label,
  description,
  required,
  reads,
  fileName,
  uploading,
  previewUri = null,
  isPdf = false,
  error = null,
  onPick,
  onRemove,
}: {
  /** 1-based, so the list reads as a checklist rather than a pile. */
  position: number;
  total: number;
  label: string;
  /** Guidance the organisation wrote: which document, and what it has to show. */
  description: string | null;
  required: boolean;
  /** The named values the server will read off it, in the author's words. */
  reads: readonly string[];
  fileName: string | null;
  uploading: boolean;
  previewUri?: string | null;
  isPdf?: boolean;
  error?: string | null;
  onPick: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const done = fileName !== null && !uploading;

  return (
    <View
      accessibilityLabel={label}
      style={{
        marginBottom: spacing.md,
        borderWidth: 1,
        borderRadius: radius.md,
        overflow: 'hidden',
        // The card is the LIFTED surface and the wells inside it are the page
        // colour — the web SDK's arrangement (a `bg-secondary` card over a
        // `bg-background` well), which Flutter also takes.
        backgroundColor: done ? colors.primary50 : colors.backgroundSecondary,
        borderColor: done ? colors.primary200 : colors.border,
      }}
    >
      <View style={{ padding: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <DocumentMarker done={done} position={position} total={total} />
          <View style={{ width: spacing.sm + 4 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <MyazaText variant="label" style={{ fontWeight: '600' }}>
              {label}
            </MyazaText>
            {description ? (
              <MyazaText
                variant="bodySmall"
                color={colors.textDark}
                style={{ marginTop: 4, opacity: 0.75 }}
              >
                {description}
              </MyazaText>
            ) : null}
          </View>
          <View style={{ width: spacing.sm }} />
          <DocumentStatePill required={required} />
        </View>

        {reads.length > 0 ? (
          <>
            <View style={{ height: spacing.sm + 4 }} />
            <DocumentReads reads={reads} />
          </>
        ) : null}
      </View>

      <View style={{ height: 1, backgroundColor: colors.border }} />

      <View style={{ padding: spacing.sm + 4 }}>
        <BusinessDocumentSlot
          label={label}
          required={required}
          fileName={fileName}
          uploading={uploading}
          previewUri={previewUri}
          isPdf={isPdf}
          onPick={onPick}
          onRemove={onRemove}
          compact
        />
        {error ? (
          <MyazaText
            variant="bodySmall"
            color={colors.error}
            style={{ marginTop: spacing.sm }}
          >
            {error}
          </MyazaText>
        ) : null}
      </View>
    </View>
  );
}
