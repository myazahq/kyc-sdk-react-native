import React from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { Icon } from '../components/Icon';
import { useTheme } from '../components/runtime';
import { UiText } from '../components/Typography';
import { SignaturePreview } from '../components/SignaturePreview';
import type { SignatureDrawing } from '../lib/signature';

// A signature that has been kept: what was signed, an Edit that reopens the pad
// with it, and a remove. The same row an uploaded file gets, with the drawing
// where the file's thumbnail would be.
//
// The drawing lives only as long as the screen, so a resumed session has none
// and shows the pen mark instead. MIRRORS the web card's signed row and the
// Flutter SignedSignatureRow.

export function SignedSignatureRow({
  drawing,
  label,
  onEdit,
  onRemove,
}: {
  drawing: SignatureDrawing | null;
  label: string;
  onEdit: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        backgroundColor: colors.backgroundSecondary,
        padding: spacing.md,
      }}
    >
      {drawing ? (
        <SignaturePreview drawing={drawing} label="Your signature" />
      ) : (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary50,
          }}
        >
          <Icon name="pen-line" size={16} color={colors.primary} />
        </View>
      )}
      <View style={{ width: spacing.sm + 4 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <UiText variant="label" style={{ fontWeight: '600' }} numberOfLines={1}>
          {'Signed on screen'}
        </UiText>
      </View>
      <Pressable
        onPress={onEdit}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${label}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.7 : 1 })}
      >
        <Icon name="pen-line" size={14} color={colors.primary} />
        <View style={{ width: 4 }} />
        <UiText variant="bodySmall" color={colors.primary} style={{ fontWeight: '600' }}>
          {'Edit'}
        </UiText>
      </Pressable>
      <View style={{ width: spacing.sm + 4 }} />
      <Pressable onPress={onRemove} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${label}`}>
        <Icon name="close" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
