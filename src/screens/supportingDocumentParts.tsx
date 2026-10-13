import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { UiText } from '../components/Typography';
import { Icon } from '../components/Icon';
import { useText } from '../i18n/useText';

// ---------------------------------------------------------------------------
// The pieces of a supporting-document card.
//
// Split out of the card itself only for the file-length rule; they are that
// card's own furniture and nothing else builds them. The Flutter SDK splits
// the same three into supporting_document_parts.dart, for the same reason.
// ---------------------------------------------------------------------------

const MARKER = 28;

/** A count while the document is outstanding, and a state anybody can read once
 *  it is not. One document needs no number, so it wears a document glyph. */
export function DocumentMarker({
  done,
  position,
  total,
}: {
  done: boolean;
  position: number;
  total: number;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: MARKER,
        height: MARKER,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: done ? colors.primary : colors.primary100,
      }}
    >
      {done ? (
        <Icon name="check" size={16} color={colors.onPrimary} />
      ) : total > 1 ? (
        <UiText variant="bodySmall" color={colors.primary} style={{ fontWeight: '700' }}>
          {String(position)}
        </UiText>
      ) : (
        <Icon name="file-text" size={14} color={colors.primary} />
      )}
    </View>
  );
}

/** Required or optional, in a word as well as a colour. */
export function DocumentStatePill({ required }: { required: boolean }): React.ReactElement {
  const { colors } = useTheme();
  const t = useText();
  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
        backgroundColor: required ? colors.errorBg : colors.background,
      }}
    >
      <UiText
        variant="bodySmall"
        color={required ? colors.error : colors.textSecondary}
        style={{ fontWeight: '600' }}
      >
        {t(required ? 'supportingDocuments.card.required' : 'supportingDocuments.card.optional')}
      </UiText>
    </View>
  );
}

/** What the server will take off this document, named as the author named it. */
export function DocumentReads({ reads }: { reads: readonly string[] }): React.ReactElement {
  const { colors } = useTheme();
  const t = useText();
  return (
    <View
      style={{
        padding: spacing.sm + 4,
        borderRadius: radius.sm,
        backgroundColor: colors.background,
      }}
    >
      <UiText
        variant="bodySmall"
        color={colors.textSecondary}
        style={{ fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' }}
      >
        {t('supportingDocuments.card.reads')}
      </UiText>
      <View
        style={{
          marginTop: spacing.sm,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs + 2,
        }}
      >
        {reads.map((read) => (
          <View
            key={read}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.backgroundSecondary,
            }}
          >
            <Icon name="check" size={12} color={colors.primary} />
            <View style={{ width: 4 }} />
            <UiText variant="bodySmall">{read}</UiText>
          </View>
        ))}
      </View>
    </View>
  );
}
