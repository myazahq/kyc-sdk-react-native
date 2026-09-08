import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useEffectiveCountry, useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MediaSourceSheet } from '../components/MediaSourceSheet';
import { PoaDocumentTypeList } from './PoaDocumentTypeList';
import { configScope } from '../lib/scope';
import { withRetry } from '../services/retry';
import { compressDocumentImage } from '../services/mediaCompress';
import { uploadFailureMessage } from '../services/uploadErrors';
import { poaDocumentTypes, poaMaxAgeDays, poaTypeLabel } from '../config/proofOfAddress';
import { usePoaAttach, type PoaPick } from './usePoaAttach';
import { AddressCountryControl, poaOfferedCountries } from './AddressCountryControl';
import { poaCountryDeclared } from '../lib/poa-country-gate';
import { PoaDropzone, PoaUploadedRow } from './ProofOfAddressParts';
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

export function proofOfAddressMeta(
  maxAgeDays: number,
  /** Whether the workflow's name rule wants the applicant's name on THIS
   *  document. False for e.g. a Nigerian utility bill that names the meter,
   *  not the tenant — asking for "your name" there sends people hunting for a
   *  document they do not have. */
  nameNeeded = true,
): { title: string; description: string } {
  return {
    title: 'Proof of address',
    description: `Upload a document that shows your ${nameNeeded ? 'name and home address' : 'home address'}, issued within the last ${maxAgeDays} days.`,
  };
}

export function ProofOfAddressStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const { colors } = useTheme();
  const mediaId = useKyc((s) => s.mediaIds.proofOfAddress);
  const fileName = useKyc((s) => s.poaFileName);
  const storedType = useKyc((s) => s.poaDocumentType);

  // The kinds on offer follow the country — on the address scope the picker
  // below changes it, and an org may accept different documents per market.
  const country = useEffectiveCountry();
  const types = poaDocumentTypes(config.proofOfAddress, country);
  // The flag on the attachment area: on the address scope only a country the
  // applicant picked (the scope has no seeded country to show), else the
  // flow's effective country.
  const selectedCountry = useKyc((s) => s.selectedCountry);
  const flagCountry = configScope(config) === 'address' ? (selectedCountry ?? null) : (country ?? null);
  const [selectedType, setSelectedType] = useState<PoaDocumentType>(storedType ?? types[0]!);
  const typesKey = types.join(',');
  useEffect(() => {
    // A country change can withdraw the picked kind; fall back to the first
    // offered rather than submitting a label that country does not accept.
    if (!types.includes(selectedType)) setSelectedType(types[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typesKey]);
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
      } catch (e) {
        setPreview(null);
        setError(uploadFailureMessage(e));
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
  // The address scope's country is the applicant's declaration and drives the
  // document's market; Continue holds until it is made (the control above
  // asks for it). Never bites elsewhere. See lib/poa-country-gate.ts.
  const countryDeclared = poaCountryDeclared({
    scope: configScope(config),
    selectedCountry,
    offered: poaOfferedCountries(config.proofOfAddress?.countries),
  });

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
      <AddressCountryControl />
      {types.length > 1 ? (
        <>
          <MyazaText variant="bodySmall" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
            Document type
          </MyazaText>
          <PoaDocumentTypeList
            value={selectedType}
            // Locked once a file is attached: switching the kind afterwards
            // would mislabel the document already uploaded.
            disabled={uploaded || busy}
            options={types.map((type) => ({
              value: type,
              label: poaTypeLabel(type, config.proofOfAddress),
            }))}
            onChange={setSelectedType}
          />
          <View style={{ height: spacing.sm }} />
        </>
      ) : null}

      {uploaded ? (
        <PoaUploadedRow
          preview={preview}
          fileName={fileName}
          typeLabel={typeLabel}
          country={flagCountry}
          onRemove={remove}
        />
      ) : (
        <PoaDropzone busy={busy} typeLabel={typeLabel} country={flagCountry} onPress={() => void pick()} />
      )}

      {error ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.sm }}>
          {error}
        </MyazaText>
      ) : null}

      <View style={{ height: spacing.lg }} />
      <MyazaButton
        label="Continue"
        disabled={!mediaId || busy || !countryDeclared}
        onPress={() => store.getState().nextStep()}
      />
    </View>
  );
}
