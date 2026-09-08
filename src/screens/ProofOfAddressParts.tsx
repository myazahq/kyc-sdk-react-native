import React from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { UPLOAD_HINT } from '../config/uploadLimits';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { Icon } from '../components/Icon';
import { DashedBorder } from '../components/DashedBorder';
import { CountryFlag } from '../components/CountryFlag';

// ---------------------------------------------------------------------------
// Proof of Address — the two states of the attachment area, split out of the
// step (200-line rule; mirrors the Flutter SDK's proof_of_address_parts).
// Pure presentation: the step owns the picking, uploading and removing.
//
// Both states carry the country the document is for (user decision
// 2026-09-05): the flag before the call to action on the drop zone, and before
// the document kind on the uploaded row, so a person on a multi-market flow
// sees which market the paper is being read against. Null when the flow does
// not know it yet (the address scope before a pick) — nothing is invented.
// ---------------------------------------------------------------------------

function Flag({ country, size }: { country: string | null; size: number }): React.ReactElement | null {
  if (!country) return null;
  return (
    <>
      <CountryFlag country={country} size={size} />
      <View style={{ width: spacing.xs }} />
    </>
  );
}

export function PoaUploadedRow({
  preview,
  fileName,
  typeLabel,
  country,
  onRemove,
}: {
  preview: { uri: string; isPdf: boolean } | null;
  fileName: string | null;
  typeLabel: string;
  country: string | null;
  onRemove: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.backgroundSecondary,
      }}
    >
      {preview && !preview.isPdf ? (
        <Image
          source={{ uri: preview.uri }}
          style={{ width: 48, height: 48, borderRadius: radius.sm }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="file-text" size={22} color={colors.primary} />
        </View>
      )}
      <View style={{ width: spacing.md, flexShrink: 0 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <MyazaText variant="bodySmall" style={{ fontWeight: '600' }} numberOfLines={1}>
          {fileName ?? 'Document uploaded'}
        </MyazaText>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Flag country={country} size={14} />
          <MyazaText variant="bodySmall" color={colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
            {typeLabel}
          </MyazaText>
        </View>
      </View>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel="Remove document"
        hitSlop={8}
      >
        <Icon name="x" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

/** The DASHED drop zone that NAMES the document being asked for. */
export function PoaDropzone({
  busy,
  typeLabel,
  country,
  onPress,
}: {
  busy: boolean;
  typeLabel: string;
  country: string | null;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (!busy) onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Upload your ${typeLabel.toLowerCase()}`}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
      }}
    >
      <DashedBorder color={colors.border} radius={radius.md} strokeWidth={1.5} />
      {busy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Icon name="upload" size={30} color={colors.textSecondary} />
      )}
      <View style={{ height: spacing.sm }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Flag country={country} size={18} />
        <MyazaText variant="bodySmall" style={{ fontWeight: '600' }}>
          {busy ? 'Uploading…' : `Upload your ${typeLabel.toLowerCase()}`}
        </MyazaText>
      </View>
      <MyazaText variant="bodySmall" color={colors.textSecondary}>
        {UPLOAD_HINT}
      </MyazaText>
    </Pressable>
  );
}
