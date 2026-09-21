import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { Icon } from './Icon';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';

/**
 * "Required: <document>" — which document this step expects, on the screens
 * either side of the camera (the ready primer and the review).
 *
 * The header names the document too, but this is the last thing in view when
 * the applicant is deciding whether they have the right one in hand, and on a
 * two-sided ID it is the only place that says which SIDE is being asked for
 * and how far through they are.
 *
 * Mirrors the web SDK's badge in DocumentCaptureStep and Flutter's
 * `_RequiredPill`: same Lucide glyph, same primary tint, same wording.
 */
export function RequiredDocumentPill({
  idTypeLabel,
  sideBadge,
  stepLabel,
}: {
  idTypeLabel: string;
  /** "Front Side" / "Back Side" — two-sided documents only. */
  sideBadge?: string | null;
  /** "Step 1 of 2" — two-sided documents only. */
  stepLabel?: string | null;
}): React.ReactElement {
  const { colors } = useTheme();
  const hasMeta = Boolean(sideBadge || stepLabel);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        // Column and row gaps are set separately: when this wraps, the two
        // groups need breathing room vertically too, and a single `gap` gives
        // the wrapped row the same spacing as the inline one by accident.
        columnGap: spacing.sm,
        rowGap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.primary200,
        backgroundColor: colors.primary50,
      }}
      // One statement to a screen reader; the parts read as a sentence
      // rather than three disconnected fragments.
      accessible
      accessibilityLabel={[`Required: ${idTypeLabel}`, sideBadge, stepLabel]
        .filter(Boolean)
        .join(', ')}
    >
      {/* What the applicant has to be holding. Shrinks and wraps within its
          own box before it pushes anything else off the line, because the
          document name is the one part of this that cannot be abbreviated —
          "Permanent Voter's Card" truncated is a different document. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          flexShrink: 1,
          minWidth: 0,
        }}
      >
        <Icon name="credit-card" size={16} color={colors.primary} />
        <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '600' }}>
          Required:
        </MyazaText>
        <MyazaText variant="bodySmall" color={colors.primary} style={{ flexShrink: 1 }}>
          {idTypeLabel}
        </MyazaText>
      </View>
      {/* Side and progress travel TOGETHER. They are one thought — which half
          of a two-sided document this is — and on a narrow screen they drop to
          a second line as a pair.
          The step label used to carry `marginLeft: 'auto'`, which fights
          `flexWrap`: auto-margin assumes spare space on the line, wrapping
          means there is none. So on a long document name it wrapped alone and
          was then flung to the right edge, leaving an orphaned "Step 1 of 2"
          under an empty gap. Seen on a Galaxy S24 with "Permanent Voter's
          Card". Grouping them makes the wrap look deliberate instead. */}
      {hasMeta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {sideBadge ? (
            <View
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radius.full,
                backgroundColor: colors.primary100,
              }}
            >
              <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '600' }}>
                {sideBadge}
              </MyazaText>
            </View>
          ) : null}
          {stepLabel ? (
            <MyazaText variant="bodySmall" color={colors.textSecondary}>
              {stepLabel}
            </MyazaText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
