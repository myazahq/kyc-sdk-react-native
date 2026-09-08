import React from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { DashedBorder } from '../../components/DashedBorder';
import { Icon } from '../../components/Icon';
import { OverlayPill, pillSurface } from './EntrancePills';
import { MyazaText } from '../../components/Typography';

const FRAME_HEIGHT = 300;

/**
 * The entrance photo: the hero of its step, so it is a full-width dropzone
 * rather than a button in a list.
 *
 * Filled, it shows the photo itself with Replace and Remove over it. A RESTORED
 * session holds the uploaded mediaId but not the bytes, so that case gets an
 * honest "photo added" placeholder instead of a broken image.
 */
export function EntranceDropzone({
  uploaded,
  uploading,
  previewUri,
  required,
  onPick,
  onRemove,
}: {
  uploaded: boolean;
  uploading: boolean;
  /** Local preview of the picked file; absent on a restored session. */
  previewUri: string | null;
  required: boolean;
  onPick: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const { colors } = useTheme();

  if (uploaded && !uploading) {
    return (
      <View
        style={{
          height: FRAME_HEIGHT,
          borderRadius: radius.md,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.backgroundSecondary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            resizeMode="cover"
          />
        ) : (
          <>
            <Icon name="check" size={30} color={colors.success} />
            <View style={{ height: spacing.sm }} />
            <MyazaText variant="bodyMedium" style={{ fontWeight: '600' }}>
              Entrance photo added
            </MyazaText>
          </>
        )}

        {/* Web's tag: `text-[11px] font-semibold uppercase tracking-wider
            text-primary` with a 12px check, on a 90% background. */}
        <View
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: 4,
            borderRadius: radius.full,
            ...pillSurface(colors.background, colors.textDark),
          }}
        >
          <Icon name="circle-check" size={12} color={colors.primary} />
          <MyazaText
            variant="bodySmall"
            color={colors.primary}
            style={{ fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            Entrance photo
          </MyazaText>
        </View>

        <View
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            flexDirection: 'row',
            gap: spacing.sm,
          }}
        >
          <OverlayPill icon="refresh-ccw" label="Replace" onPress={onPick} />
          <OverlayPill icon="x" label="Remove" accessibilityLabel="Remove photo" onPress={onRemove} />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={uploading ? undefined : onPick}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel="Take or upload a photo"
      style={{
        height: FRAME_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
      }}
    >
      <DashedBorder color={colors.border} radius={radius.md} strokeWidth={2} />
      {/* Web's `h-14 w-14 rounded-2xl bg-primary/10 ring-1 ring-primary/20`,
          the box Flutter draws too. */}
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${colors.primary}1A`,
          borderWidth: 1,
          borderColor: `${colors.primary}33`,
        }}
      >
        {uploading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Icon name="camera" size={24} color={colors.primary} />
        )}
      </View>
      <View style={{ height: spacing.md }} />
      <MyazaText variant="body" style={{ fontWeight: '600' }}>
        {uploading ? 'Uploading photo…' : 'Take or upload a photo'}
      </MyazaText>
      {uploading ? null : (
        <>
          <MyazaText
            variant="bodyMedium"
            color={colors.textSecondary}
            style={{ marginTop: spacing.xs, textAlign: 'center' }}
          >
            {required
              ? 'The gate, front door or the building itself.'
              : 'The gate, front door or the building itself. Optional.'}
          </MyazaText>
          <View
            style={{
              marginTop: spacing.md,
              paddingHorizontal: spacing.sm + 2,
              paddingVertical: 4,
              borderRadius: radius.full,
              backgroundColor: colors.backgroundSecondary,
            }}
          >
            <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ fontSize: 11, fontWeight: '500' }}>
              JPEG · PNG · WebP
            </MyazaText>
          </View>
        </>
      )}
    </Pressable>
  );
}
