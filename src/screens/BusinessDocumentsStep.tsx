import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MediaSourceSheet } from '../components/MediaSourceSheet';
import { BusinessDocumentSlot } from './BusinessDocumentSlot';
import { withRetry } from '../services/retry';
import { compressDocumentImage } from '../services/mediaCompress';
import { resolveBusinessDocumentTypes, type ResolvedBusinessDocumentType } from '../config/businessSteps';
import { isAcceptedPoaMimeType, POA_ACCEPTED_MIME_TYPES } from '../config/proofOfAddress';
import { loadDocumentPicker } from '../services/documentPicker';

// ---------------------------------------------------------------------------
// Supporting company documents (certificate of incorporation, MEMART, …).
//
// The registry says a business exists; these are what say the applicant holds
// its paperwork. The server OCRs each one and cross-checks it against the
// registry record — a soft result that never fails the verification, so the
// only thing blocking here is a REQUIRED slot left empty, which the server
// would 422 anyway.
//
// Layout mirrors the web SDK 1:1: the header carries the description, each
// document is a dashed upload slot (see BusinessDocumentSlot), and Continue is
// disabled until every required slot is filled. Tapping a slot opens the
// photo/file source sheet — the mobile stand-in for web's file input.
// ---------------------------------------------------------------------------

export const businessDocumentsMeta = {
  title: 'Business documents',
  description:
    'Upload the supporting documents for your business. Required documents are marked with *.',
};

export function BusinessDocumentsStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const { colors } = useTheme();
  const uploaded = useKyc((s) => s.businessApplication.documents);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [pickingSlot, setPickingSlot] = useState<ResolvedBusinessDocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slots = useMemo(
    () => resolveBusinessDocumentTypes(config.business),
    [config.business],
  );
  const missing = slots.filter((s) => s.required && !uploaded.some((d) => d.type === s.key));

  const attach = useCallback(
    async (slot: ResolvedBusinessDocumentType, uri: string, mimeType: string | undefined, name: string) => {
      setBusySlot(slot.key);
      setError(null);
      try {
        // A PDF is passed through untouched — re-encoding would destroy the
        // text the server reads off it.
        const isPdf = (mimeType ?? '').toLowerCase().startsWith('application/pdf');
        const finalUri = isPdf ? uri : await compressDocumentImage(uri).catch(() => uri);
        const mediaId = await withRetry(() =>
          store.getState().api.upload({ uri: finalUri, type: mimeType, name }, 'business_document'),
        );
        // Preview details ride the RECORD so the thumbnail survives leaving
        // the step — screen-local state dies with the component.
        store.getState().setBusinessDocument({
          type: slot.key,
          mediaId,
          fileName: name,
          ...(isPdf ? { isPdf: true } : { previewUri: finalUri }),
        });
      } catch {
        setError(`We could not upload ${slot.label.toLowerCase()}. Please try again.`);
      } finally {
        setBusySlot(null);
      }
    },
    [store],
  );

  const takePhoto = useCallback(
    async (slot: ResolvedBusinessDocumentType) => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera access is needed to photograph the document.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset) {
        // A FRIENDLY name, not the picker's temp junk — camera/library assets
        // carry generated names; the slot key says what the file IS.
        await attach(slot, asset.uri, asset.mimeType ?? 'image/jpeg', `${slot.key}.jpg`);
      }
    },
    [attach],
  );

  const choosePhoto = useCallback(
    async (slot: ResolvedBusinessDocumentType) => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset) {
        await attach(slot, asset.uri, asset.mimeType ?? 'image/jpeg', `${slot.key}.jpg`);
      }
    },
    [attach],
  );

  const chooseFile = useCallback(
    async (slot: ResolvedBusinessDocumentType) => {
      const picker = loadDocumentPicker();
      if (!picker) {
        setError('Choosing a file is not available in this app. Please photograph the document.');
        return;
      }
      const result = await picker.getDocumentAsync({
        type: [...POA_ACCEPTED_MIME_TYPES],
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (!asset) return;
      if (!isAcceptedPoaMimeType(asset.mimeType)) {
        setError('Please choose a photo (JPEG, PNG or WebP) or a PDF.');
        return;
      }
      await attach(slot, asset.uri, asset.mimeType, asset.name ?? slot.key);
    },
    [attach],
  );

  const handleContinue = (): void => {
    if (missing.length > 0 || busySlot !== null) return;
    store.getState().nextStep();
  };

  return (
    <View>
      {slots.map((slot) => {
        const doc = uploaded.find((d) => d.type === slot.key);
        return (
          <BusinessDocumentSlot
            key={slot.key}
            label={slot.label}
            required={slot.required}
            fileName={doc?.fileName ?? null}
            uploading={busySlot === slot.key}
            previewUri={doc?.previewUri ?? null}
            isPdf={doc?.isPdf === true}
            onPick={() => setPickingSlot(slot)}
            onRemove={() => store.getState().removeBusinessDocument(slot.key)}
          />
        );
      })}

      {error ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginBottom: spacing.sm }}>
          {error}
        </MyazaText>
      ) : null}

      <View style={{ height: spacing.xs }} />
      <MyazaButton
        label="Continue"
        onPress={handleContinue}
        disabled={missing.length > 0 || busySlot !== null}
      />

      {/* THE SAME sheet as the Proof of Address step — identical title,
          options, icons and captions, so uploading a document feels the same
          everywhere in the flow. */}
      <MediaSourceSheet
        open={pickingSlot !== null}
        title="Upload your document"
        onClose={() => setPickingSlot(null)}
        options={[
          {
            icon: 'image',
            label: 'Photo library',
            caption: 'Pick a photo you already have',
            onPress: () => {
              const slot = pickingSlot;
              setPickingSlot(null);
              if (slot) void choosePhoto(slot);
            },
          },
          {
            icon: 'camera',
            label: 'Take a photo',
            caption: 'Photograph the document now',
            onPress: () => {
              const slot = pickingSlot;
              setPickingSlot(null);
              if (slot) void takePhoto(slot);
            },
          },
          {
            icon: 'file-text',
            label: 'Choose a file',
            caption: 'A PDF or image from your files',
            onPress: () => {
              const slot = pickingSlot;
              setPickingSlot(null);
              if (slot) void chooseFile(slot);
            },
          },
        ]}
      />
    </View>
  );
}
