import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../../config/theme';
import { useKyc, useKycStore, useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { MyazaButton } from '../../components/MyazaButton';
import { MediaSourceSheet } from '../../components/MediaSourceSheet';
import { StickyActions } from '../../components/StickyActions';
import { withRetry } from '../../services/retry';
import { compressDocumentImage } from '../../services/mediaCompress';
import { addressVendorsStubbed } from '../../lib/address-flow';
import { streetViewFrameUrlOf } from '../../lib/map-frame';
import { useAddressPhotoAttach, type AddressPhotoPick } from '../useAddressPhotoAttach';
import { useAddressFlow } from './use-address-flow';
import { EntranceDropzone } from './EntranceDropzone';
import { EntrancePlaceholder } from './EntranceFraming';
import { FramedStreetView } from './FramedStreetView';

/**
 * The entrance step: Street View FIRST — it opens automatically wherever
 * Google has photographed the street, because framing beats fumbling for a
 * camera — and the applicant's own photo is the fallback (no coverage, or
 * they skip). Capturing a frame advances straight to review. The panorama
 * reaches a phone the way the map does: the hosted /embed/street-view page in
 * a WebView on the app grant (FramedStreetView). Mirrors the web and Flutter
 * AddressEntranceStep.
 */
export function AddressEntranceStep(): React.ReactElement | null {
  const store = useKycStore();
  const flow = useAddressFlow();
  const mapsFrameUrl = useKyc((s) => s.serverConfig.mapsFrameUrl ?? null);
  const vendorsStubbed = addressVendorsStubbed({
    environment: useKyc((s) => s.serverConfig.environment ?? null),
  });
  const svFrameUrl = mapsFrameUrl ? streetViewFrameUrlOf(mapsFrameUrl) : null;
  // Street View can be shown: offered by the flow, a pin to look from, and
  // either the sandbox stand-in or a framed page to load.
  const streetView = flow.streetViewOffered && Boolean(flow.pin) && (vendorsStubbed || Boolean(svFrameUrl));
  const [mode, setMode] = useState<'framing' | 'photo'>(() => (streetView ? 'framing' : 'photo'));
  const [skipped, setSkipped] = useState(false);
  const framing = mode === 'framing' && streetView && Boolean(flow.pin);

  // The sheet header describes the framing while it is up, the photo after.
  useEffect(() => {
    store.getState().setAddressEntranceFraming(framing);
    return () => store.getState().setAddressEntranceFraming(false);
  }, [framing, store]);

  // Fell back to the photo with the photo input off: nothing left to capture
  // here, carry on. (The never-offered case is `recoverAddressStep`'s.)
  const { goNext } = flow;
  const emptyAfterFallback = !framing && flow.streetViewOffered && flow.photoMode === 'off';
  useEffect(() => {
    if (emptyAfterFallback) goNext();
  }, [emptyAfterFallback, goNext]);

  // Nothing to capture at all: this step is absent from the flow, and the
  // address flow's own recovery moves the applicant, not this screen.
  if (flow.photoMode === 'off' && !flow.streetViewOffered) return null;

  if (framing && flow.pin) {
    const svRequired = flow.cfg?.streetView === 'required';
    const toPhoto = (wasSkip: boolean) => {
      setSkipped(wasSkip);
      setMode('photo');
    };
    if (vendorsStubbed) {
      return <EntrancePlaceholder hideSkip={svRequired} onSkip={() => toPhoto(true)} onUse={() => flow.goNext()} />;
    }
    return (
      <FramedStreetView
        frameUrl={svFrameUrl!}
        pin={flow.pin}
        hideSkip={svRequired}
        onCaptured={(frame) => {
          const current = store.getState().address;
          if (current) store.getState().setAddress({ ...current, streetView: frame });
          flow.goNext();
        }}
        onSkip={() => toPhoto(true)}
        onUnavailable={() => toPhoto(false)}
      />
    );
  }
  if (emptyAfterFallback) return null;
  return <EntrancePhoto flow={flow} skipped={skipped} />;
}

/** The photo half, split so the framing branch above stays hook-free. */
function EntrancePhoto({
  flow,
  skipped,
}: {
  flow: ReturnType<typeof useAddressFlow>;
  skipped: boolean;
}): React.ReactElement {
  const store = useKycStore();
  const { colors } = useTheme();
  const photoId = useKyc((s) => s.mediaIds.addressPhoto);
  const previewUri = useKyc((s) => s.addressPhotoPreview);
  const { pickPhoto, setError } = flow;

  const upload = useCallback(
    async ({ uri, mimeType, name }: AddressPhotoPick) => {
      await pickPhoto(async () => {
        const finalUri = await compressDocumentImage(uri).catch(() => uri);
        return withRetry(() => store.getState().api.upload({ uri: finalUri, type: mimeType, name }, 'address_photo'));
      }, uri);
    },
    [pickPhoto, store],
  );

  const { pick, sheetOpen, closeSheet, choosePhoto, takePhoto } = useAddressPhotoAttach(upload, setError);

  const uploaded = Boolean(photoId);
  const required = flow.photoMode === 'required';

  return (
    <StickyActions
      actions={
        <MyazaButton
          label={uploaded || required ? 'Continue' : 'Continue without a photo'}
          disabled={flow.uploading || (required && !uploaded)}
          onPress={() => flow.goNext()}
        />
      }
    >
      <MediaSourceSheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Add a photo of the entrance"
        options={[
          { icon: 'camera', label: 'Take a photo', caption: 'Photograph the entrance now', onPress: () => void takePhoto() },
          { icon: 'image', label: 'Photo library', caption: 'Pick a photo you already have', onPress: () => void choosePhoto() },
        ]}
      />

      {skipped ? (
        <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>
          No problem. A quick photo of the entrance works just as well.
        </MyazaText>
      ) : null}

      <EntranceDropzone
        uploaded={uploaded}
        uploading={flow.uploading}
        previewUri={previewUri}
        required={required}
        onPick={() => pick()}
        onRemove={flow.removePhoto}
      />

      {flow.error ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.sm }}>
          {flow.error}
        </MyazaText>
      ) : null}
    </StickyActions>
  );
}
