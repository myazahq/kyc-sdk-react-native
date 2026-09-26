import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MediaSourceSheet } from '../components/MediaSourceSheet';
import { SupportingDocumentCard } from './SupportingDocumentCard';
import { withRetry } from '../services/retry';
import { compressDocumentImage } from '../services/mediaCompress';
import {
  resolveSupportingDocuments,
  verifiedIdsFor,
  type RequestedSupportingDocument,
} from '../config/supportingDocuments';
import { useBusinessDocumentAttach } from './useBusinessDocumentAttach';
import { supportingDocumentsIntro } from '../lib/supportingDocumentsIntro';

// ---------------------------------------------------------------------------
// Supporting documents — artefacts the organisation keeps ON FILE.
//
// These are NOT the identity evidence this verification is decided on. The
// person has already been checked against the government record by the time
// they reach this screen, so a document that cannot be read costs them
// nothing: the server records it and the verification stands on the lookup.
//
// WHICH documents are asked for depends on the ID they picked (a document may
// exist only because they used a particular ID), so the screen is only in the
// order when that resolution produced something — see store/derive.ts.
//
// Layout mirrors the web SDK's SupportingDocumentCard and the Flutter one 1:1:
// a card per document naming what it is being taken FOR, over the same source
// sheet and the same Continue rule as the business-documents screen.
// ---------------------------------------------------------------------------

/** The header, from the slots the flow actually resolved for this applicant.
 *  A function because the line carries the COUNTS: how many documents have to
 *  be produced before they can go on. */
export const supportingDocumentsMeta = (
  slots: ReadonlyArray<{ required: boolean }>,
): { title: string; description: string } => ({
  title: 'Supporting documents',
  description: supportingDocumentsIntro(slots),
});

export function SupportingDocumentsStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const { colors } = useTheme();
  const uploaded = useKyc((s) => s.supportingDocuments);
  const selectedCountry = useKyc((s) => s.selectedCountry);
  const selectedIdType = useKyc((s) => s.selectedIdType);
  const multiIdSlots = useKyc((s) => s.multiIdSlots);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [pickingSlot, setPickingSlot] = useState<RequestedSupportingDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which card the message belongs to. A failed upload is about ONE document
  // and reads as noise anywhere else; a picker error belongs to no card and
  // keeps its place under the list.
  const [errorSlot, setErrorSlot] = useState<string | null>(null);

  const slots = useMemo(
    () =>
      resolveSupportingDocuments(
        config.supportingDocuments,
        verifiedIdsFor({
          country: selectedCountry ?? config.country,
          idType: selectedIdType,
          multiIdSlots,
        }),
      ),
    [config.supportingDocuments, config.country, selectedCountry, selectedIdType, multiIdSlots],
  );
  const missing = slots.filter((s) => s.required && !uploaded.some((d) => d.type === s.key));

  const attach = useCallback(
    async (slot: RequestedSupportingDocument, uri: string, mimeType: string | undefined, name: string) => {
      setBusySlot(slot.key);
      setError(null);
      setErrorSlot(null);
      try {
        // A PDF is passed through untouched — re-encoding would destroy the
        // text the server reads off it.
        const isPdf = (mimeType ?? '').toLowerCase().startsWith('application/pdf');
        const finalUri = isPdf ? uri : await compressDocumentImage(uri).catch(() => uri);
        const mediaId = await withRetry(() =>
          store.getState().api.upload({ uri: finalUri, type: mimeType, name }, 'supporting_document'),
        );
        store.getState().setSupportingDocument({
          type: slot.key,
          mediaId,
          fileName: name,
          // Seeing the file back is how somebody catches the wrong photo from
          // the camera roll before submitting. A PDF has no preview to show.
          ...(isPdf ? { isPdf: true } : { previewUri: finalUri }),
        });
      } catch {
        setError(`We could not upload ${slot.label.toLowerCase()}. Please try again.`);
        setErrorSlot(slot.key);
      } finally {
        setBusySlot(null);
      }
    },
    [store],
  );

  // A picker failure belongs to no card, so it clears the slot the last upload
  // error was pinned to — otherwise it would surface under an unrelated
  // document.
  const reportPickerError = useCallback((message: string | null) => {
    setErrorSlot(null);
    setError(message);
  }, []);

  const { takePhoto, choosePhoto, chooseFile } = useBusinessDocumentAttach(attach, reportPickerError);

  const handleContinue = (): void => {
    if (missing.length > 0 || busySlot !== null) return;
    store.getState().nextStep();
  };

  const optionalOnly = slots.every((slot) => !slot.required);

  return (
    <View>
      {slots.map((slot, i) => {
        const doc = uploaded.find((d) => d.type === slot.key);
        return (
          <SupportingDocumentCard
            key={slot.key}
            position={i + 1}
            total={slots.length}
            label={slot.label}
            description={slot.description}
            required={slot.required}
            reads={slot.reads}
            fileName={doc?.fileName ?? null}
            uploading={busySlot === slot.key}
            previewUri={doc?.previewUri ?? null}
            isPdf={doc?.isPdf ?? false}
            error={errorSlot === slot.key ? error : null}
            onPick={() => setPickingSlot(slot)}
            onRemove={() => store.getState().removeSupportingDocument(slot.key)}
          />
        );
      })}

      {error && errorSlot === null ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginBottom: spacing.sm }}>
          {error}
        </MyazaText>
      ) : null}

      <View style={{ height: spacing.xs }} />
      <MyazaButton
        label={optionalOnly && uploaded.length === 0 ? 'Skip' : 'Continue'}
        onPress={handleContinue}
        disabled={missing.length > 0 || busySlot !== null}
      />

      {/* THE SAME sheet as Proof of Address and the business documents, so
          uploading a document feels the same everywhere in the flow. */}
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
