import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { Icon } from '../components/Icon';
import { MediaSourceSheet } from '../components/MediaSourceSheet';
import { MyazaSelect } from '../components/MyazaSelect';
import { DashedBorder } from '../components/DashedBorder';
import { withRetry } from '../services/retry';
import { compressDocumentImage } from '../services/mediaCompress';
import { poaDocumentTypes, poaMaxAgeDays, poaTypeLabel } from '../config/proofOfAddress';
import { usePoaAttach, type PoaPick } from './usePoaAttach';
import type { PoaDocumentType } from '../types/workflow';

// ---------------------------------------------------------------------------
// Proof of Address — pick the kind of document, then supply it.
//
// Mirrors the web SDK: a DASHED drop zone that NAMES the document being asked
// for ("Upload your utility bill") plus what's accepted, replaced after upload
// by a row showing the file, its kind, and an X to remove it. A generic "choose
// a file" hid which of the offered document kinds the user had to supply.
//
// The check itself is soft — the server reads the document and reports a
// verdict, but never fails the verification over it — so nothing here blocks
// beyond making sure a file was actually attached.
// ---------------------------------------------------------------------------

export function proofOfAddressMeta(maxAgeDays: number): { title: string; description: string } {
  return {
    title: 'Proof of address',
    description: `Upload a document that shows your name and home address, issued within the last ${maxAgeDays} days.`,
  };
}

export function ProofOfAddressStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const { colors } = useTheme();
  const mediaId = useKyc((s) => s.mediaIds.proofOfAddress);
  const fileName = useKyc((s) => s.poaFileName);
  const storedType = useKyc((s) => s.poaDocumentType);

  const types = poaDocumentTypes(config.proofOfAddress);
  const [selectedType, setSelectedType] = useState<PoaDocumentType>(storedType ?? types[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The picked file, kept for the thumbnail — the only way a user catches
  // "wrong photo from the camera roll" before submitting.
  const [preview, setPreview] = useState<{ uri: string; isPdf: boolean } | null>(null);

  const typeLabel = poaTypeLabel(selectedType, config.proofOfAddress);

  const upload = useCallback(
    async ({ uri, mimeType, name }: PoaPick) => {
      setBusy(true);
      setError(null);
      const isPdf = (mimeType ?? '').toLowerCase().startsWith('application/pdf');
      setPreview({ uri, isPdf });
      try {
        // Photos are compressed like any other capture; a PDF is passed through
        // untouched — re-encoding it would destroy the text the server reads.
        const finalUri = isPdf ? uri : await compressDocumentImage(uri).catch(() => uri);
        const id = await withRetry(() =>
          store.getState().api.upload({ uri: finalUri, type: mimeType, name }, 'proof_of_address'),
        );
        store.getState().setProofOfAddress(id, selectedType, name);
      } catch {
        setPreview(null);
        setError('We could not upload that document. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [selectedType, store],
  );

  const { pick, sheetOpen, closeSheet, choosePhoto, takePhoto, chooseFile } = usePoaAttach(
    upload,
    setError,
  );

  const remove = useCallback(() => {
    setPreview(null);
    setError(null);
    store.getState().clearProofOfAddress();
  }, [store]);

  const uploaded = Boolean(mediaId) && !busy;

  return (
    <View>
      <MediaSourceSheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Upload your document"
        options={[
          {
            icon: 'image',
            label: 'Photo library',
            caption: 'Pick a photo you already have',
            onPress: () => void choosePhoto(),
          },
          {
            icon: 'camera',
            label: 'Take a photo',
            caption: 'Photograph the document now',
            onPress: () => void takePhoto(),
          },
          {
            icon: 'file-text',
            label: 'Choose a file',
            caption: 'A PDF or image from your files',
            onPress: () => void chooseFile(),
          },
        ]}
      />
      {types.length > 1 ? (
        <>
          <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
            Document type
          </MyazaText>
          <MyazaSelect<PoaDocumentType>
            value={selectedType}
            sheetTitle="Document type"
            // Locked once a file is attached: switching the kind afterwards
            // would mislabel the document already uploaded.
            enabled={!uploaded && !busy}
            options={types.map((type) => ({
              value: type,
              label: poaTypeLabel(type, config.proofOfAddress),
            }))}
            onChange={setSelectedType}
          />
          <View style={{ height: spacing.lg }} />
        </>
      ) : null}

      {uploaded ? (
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
            <MyazaText variant="bodySmall" color={colors.textSecondary} numberOfLines={1}>
              {typeLabel}
            </MyazaText>
          </View>
          <Pressable
            onPress={remove}
            accessibilityRole="button"
            accessibilityLabel="Remove document"
            hitSlop={8}
          >
            <Icon name="x" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            if (!busy) void pick();
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
          <DashedBorder
            color={colors.border}
            radius={radius.md}
            strokeWidth={1.5}
          />
          {busy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Icon name="upload" size={30} color={colors.textSecondary} />
          )}
          <View style={{ height: spacing.sm }} />
          <MyazaText variant="bodySmall" style={{ fontWeight: '600' }}>
            {busy ? 'Uploading…' : `Upload your ${typeLabel.toLowerCase()}`}
          </MyazaText>
          <MyazaText variant="bodySmall" color={colors.textSecondary}>
            Photo or PDF, up to 20MB
          </MyazaText>
        </Pressable>
      )}

      {error ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.sm }}>
          {error}
        </MyazaText>
      ) : null}

      <View style={{ height: spacing.lg }} />
      <MyazaButton
        label="Continue"
        disabled={!mediaId || busy}
        onPress={() => store.getState().nextStep()}
      />
    </View>
  );
}
