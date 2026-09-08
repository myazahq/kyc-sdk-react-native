import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useKyc, useKycStore, useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { MyazaButton } from '../../components/MyazaButton';
import { displayAddressLine, addressVendorsStubbed } from '../../lib/address-flow';
import { useAuthedImage } from '../../lib/authed-image';
import { missingFieldsNudge, missingRequiredAddressFields } from '../../lib/address-field-modes';
import { useAddressFlow } from './use-address-flow';
import { AddressSandboxTabs } from './AddressSandboxTabs';
import { SkipForNow } from './SkipForNow';
import { ReviewMapPicture } from './ReviewMapPicture';
import { HERO, SECOND, ReviewEntranceThumb } from './ReviewEntranceThumbs';
import { ReviewAddressBand } from './ReviewAddressBand';

/**
 * The commit point, as ONE composed card: a read-only summary map with the
 * entrance photo hanging over its bottom edge like a photo clipped to a
 * document, and the address underneath as the card's own heading. Tapping the
 * map jumps back to the pin step. The presence story lives on the intro
 * screen, not here. Workflow-required details the applicant skipped hold
 * Confirm (the pin step's own gate, repeated here as the backstop). The map
 * surface is ReviewMapPicture, the thumbnails ReviewEntranceThumbs.
 */
export function AddressReviewStep(): React.ReactElement {
  const store = useKycStore();
  const { colors } = useTheme();
  const flow = useAddressFlow();
  const previewUri = useKyc((s) => s.addressPhotoPreview);
  const mapsFrameUrl = useKyc((s) => s.serverConfig.mapsFrameUrl ?? null);
  const vendorsStubbed = addressVendorsStubbed({
    environment: useKyc((s) => s.serverConfig.environment ?? null),
  });

  // A resumed session can land straight here with a pin that predates the
  // label fields — reverse-geocode it once rather than showing coordinates.
  const { relabelPin } = flow;
  useEffect(() => {
    relabelPin();
  }, [relabelPin]);

  const address = flow.address;
  const directions = address?.directions.trim() || null;

  // The framed Street View entrance, drawn through the server: the browser
  // key lives in the framed page, never in this SDK. Fetched with the SDK's
  // bearer by lib/authed-image (an <Image> header is dropped on Android).
  const frame = address?.streetView ?? null;
  const api = useKyc((s) => s.api);
  const frameImage = useAuthedImage(frame ? api.streetViewPreviewSource(frame) : null, 'Street View entrance');
  const frameSource = frameImage.uri ? { uri: frameImage.uri } : null;
  // The map as a picture, through the same bearer; a refused one (the Static
  // API is a separate console enablement) falls back to the live map.
  const mapImage = useAuthedImage(
    flow.pin && !vendorsStubbed ? api.staticMapSource({ ...flow.pin, zoom: 16 }) : null,
    'Map picture',
  );
  const [pictureFailed, setPictureFailed] = useState(false);
  // An entrance thumbnail whose bytes never arrive must not stay on screen as
  // an empty bordered box hanging over the map (the S24, 2026-09-07); it drops
  // out, and the band's clearance with it.
  const [heroFailed, setHeroFailed] = useState(false);
  const [secondFailed, setSecondFailed] = useState(false);
  const failed = (label: string, error: unknown): void => {
    if (__DEV__) console.warn(`${label} failed to load`, error);
  };

  // The photo leads when there is one, exactly as on web; the framed view
  // takes the smaller slot beside it, or the big one when it is all there is.
  const hero = previewUri ? { uri: previewUri } : frameSource;
  const second = previewUri && frameSource ? frameSource : null;
  const heroLabel = previewUri ? 'Entrance photo' : 'Street View entrance';
  const heroShown = hero && !heroFailed ? hero : null;
  const secondShown = second && !secondFailed ? second : null;
  const missingRequired = missingRequiredAddressFields(flow.cfg, address);
  const toPin = (): void => store.getState().goToStep('address-collection');
  const line = address ? displayAddressLine(address) : '';

  return (
    <View>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
        {flow.pin ? (
          // ABOVE the band, which paints a solid background: without this the
          // entrance hanging over the map's edge was covered by it.
          <View style={{ zIndex: 2 }}>
            <ReviewMapPicture
              pin={flow.pin}
              vendorsStubbed={vendorsStubbed}
              mapsFrameUrl={mapsFrameUrl}
              staticMap={mapImage.uri ? { uri: mapImage.uri } : null}
              staticMapFailed={mapImage.failed || pictureFailed}
              onEdit={toPin}
              onPictureFailed={() => setPictureFailed(true)}
            />
            {heroShown ? (
              <ReviewEntranceThumb
                source={heroShown}
                label={heroLabel}
                size={HERO}
                right={16}
                onFailed={(e) => {
                  failed(heroLabel, e);
                  setHeroFailed(true);
                }}
              />
            ) : null}
            {secondShown ? (
              <ReviewEntranceThumb
                source={secondShown}
                label="Street View entrance"
                size={SECOND}
                right={144}
                onFailed={(e) => {
                  failed('Street View entrance', e);
                  setSecondFailed(true);
                }}
              />
            ) : null}
          </View>
        ) : null}

        <ReviewAddressBand
          isBusiness={flow.isBusiness}
          hasAddress={Boolean(address)}
          line={line}
          labelling={flow.labelling}
          directions={directions}
          clearsHero={Boolean(heroShown)}
          onEdit={toPin}
        />
      </View>

      {flow.error ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.sm }}>
          {flow.error}
        </MyazaText>
      ) : null}
      {missingRequired.length > 0 ? (
        <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.sm }}>
          {`${missingFieldsNudge(missingRequired)} `}
          <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '600' }} onPress={toPin}>
            Edit details
          </MyazaText>
        </MyazaText>
      ) : null}

      <View style={{ height: spacing.lg }} />
      <AddressSandboxTabs />
      <View style={{ height: spacing.md }} />
      <MyazaButton
        label="Confirm address"
        loading={flow.confirming}
        disabled={!flow.pin || missingRequired.length > 0}
        onPress={() => void flow.confirm()}
      />

      <SkipForNow requirePin={flow.cfg?.requirePin} onPress={flow.exitForward} />
    </View>
  );
}
