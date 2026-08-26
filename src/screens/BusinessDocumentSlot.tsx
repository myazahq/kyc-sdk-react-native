import React from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { Icon } from '../components/Icon';
import { DashedBorder } from '../components/DashedBorder';

// ---------------------------------------------------------------------------
// One business-document upload slot — mirrors the web SDK's
// BusinessDocumentSlot 1:1: empty, it is a dashed full-width tap target
// (upload glyph — a spinner while uploading — label with a red * when
// required, "Photo or PDF, up to 20MB"); filled, a solid card showing a 48px
// THUMBNAIL of what was actually picked (a muted file tile for PDFs, a check
// when the preview didn't survive a remount — web's exact fallback ladder),
// the file's name over the slot label, Replace, and remove. Showing the file
// back matters — it is the only way a user catches "wrong photo from the
// camera roll" before submitting.
// ---------------------------------------------------------------------------

/** Web parity: UploadedFileThumb is h-12 w-12 rounded-lg (48 / radius 8). */
const THUMB = 48;

function UploadedThumb({ previewUri, isPdf }: { previewUri: string | null; isPdf: boolean }): React.ReactElement {
  const { colors } = useTheme();
  if (previewUri && !isPdf) {
    return (
      <Image
        source={{ uri: previewUri }}
        resizeMode="cover"
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: radius.xs,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />
    );
  }
  if (isPdf) {
    return (
      <View
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: radius.xs,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.backgroundSecondary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="file-text" size={20} color={colors.textMuted} />
      </View>
    );
  }
  // The preview didn't survive a remount — the check still says "uploaded".
  return <Icon name="check" size={20} color={colors.success} />;
}

export function BusinessDocumentSlot({
  label,
  required,
  fileName,
  uploading,
  previewUri = null,
  isPdf = false,
  onPick,
  onRemove,
}: {
  label: string;
  required: boolean;
  /** Uploaded file name, when this slot already has a mediaId. */
  fileName: string | null;
  uploading: boolean;
  /** Local URI of the picked image, for the thumbnail (null once remounted). */
  previewUri?: string | null;
  isPdf?: boolean;
  /** Open the photo/file source sheet (also serves Replace). */
  onPick: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const { colors } = useTheme();

  if (fileName !== null && !uploading) {
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
          marginBottom: spacing.sm + 4,
        }}
      >
        <UploadedThumb previewUri={previewUri} isPdf={isPdf} />
        <View style={{ width: spacing.sm + 4 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <MyazaText variant="label" style={{ fontWeight: '600' }} numberOfLines={1}>
            {fileName}
          </MyazaText>
          <MyazaText variant="bodySmall" color={colors.textMuted}>
            {label}
          </MyazaText>
        </View>
        <Pressable onPress={onPick} hitSlop={8} accessibilityRole="button">
          <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '600' }}>
            Replace
          </MyazaText>
        </Pressable>
        <View style={{ width: spacing.sm + 4 }} />
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
        >
          <Icon name="close" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={uploading ? undefined : onPick}
      accessibilityRole="button"
      accessibilityState={{ disabled: uploading }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.sm,
        padding: spacing.md,
        marginBottom: spacing.sm + 4,
        opacity: uploading ? 0.7 : 1,
      }}
    >
      <DashedBorder color={colors.border} radius={radius.sm} />
      {uploading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Icon name="upload" size={20} color={colors.textMuted} />
      )}
      <View style={{ width: spacing.sm + 4 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <MyazaText variant="label" style={{ fontWeight: '600' }} numberOfLines={1}>
          {label}
          {required ? (
            <MyazaText variant="label" color={colors.error} style={{ fontWeight: '600' }}>
              {' *'}
            </MyazaText>
          ) : null}
        </MyazaText>
        <MyazaText variant="bodySmall" color={colors.textMuted}>
          {uploading ? 'Uploading…' : 'Photo or PDF, up to 20MB'}
        </MyazaText>
      </View>
    </Pressable>
  );
}
