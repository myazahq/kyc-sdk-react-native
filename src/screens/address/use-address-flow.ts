import { useCallback, useEffect, useMemo, useState } from 'react';

import { useKyc, useKycConfig, useKycStore } from '../../components/runtime';
import { addressFlowFor } from '../../config/addressCollection';
import { webViewAvailable } from '../../lib/webview-available';
import { isBusinessFlow } from '../../config/business';
import { addressFlowSteps, addressVendorsStubbed, isAddressStep } from '../../lib/address-flow';
import { addressExitStep, recoverAddressStep } from '../../lib/address-step-recovery';
import { defaultMapView } from '../../lib/map-tiles';
import { buildStepOrder, nextStepInOrder } from '../../config/stepOrder';
import { geoDefaultCountry } from '../../lib/country-adoption';
import { configScope } from '../../lib/scope';
import { stepOrderOptions } from '../../store/kycStore';
import { deviceFixFields } from '../../services/location';
import { savePresencePin } from '../../presence/store';
import { usePinActions } from './use-pin-actions';
import type { KYCStep } from '../../types/config';
import type { AddressState } from '../../store/state';

// ---------------------------------------------------------------------------
// The address flow's shared brain: every address step mounts this hook and gets
// the same derived flags, the same step list, and the same actions — which is
// what keeps four separate screens telling one story.
//
// Navigation rides the SDK's ONE ordered step list rather than a second copy:
// the flow's steps are already in `buildStepOrder`, so stepping forward, going
// back, and backing out of the flow entirely all fall out of the same list the
// progress bar reads. That is why nothing here reimplements goBack — the
// sheet's own back button already walks it — and why goNext is the store's
// nextStep. `nextAddressStep`/`prevAddressStep` stay in lib/address-flow as
// part of the pure mirror the three SDKs share.
//
// A MIRROR of the web SDK's steps/address/use-address-flow.ts.
// ---------------------------------------------------------------------------

export function useAddressFlow() {
  const config = useKycConfig();
  const store = useKycStore();
  const address = useKyc((s) => s.address);
  const serverSearch = useKyc((s) => s.serverConfig.addressSearch === true);
  const selectedCountry = useKyc((s) => s.selectedCountry);
  const businessCountry = useKyc((s) => s.business.country);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cfg = config.addressCollection;
  const isBusiness = isBusinessFlow(config);
  const vendorEnvironment = useKyc((s) => s.serverConfig.environment ?? null);
  const mapsFrameUrl = useKyc((s) => s.serverConfig.mapsFrameUrl ?? null);
  const flow = addressFlowFor(
    config,
    serverSearch,
    addressVendorsStubbed({ environment: vendorEnvironment }),
    Boolean(mapsFrameUrl) && webViewAvailable(),
  );
  // KYB: the premises pin + directions ARE the capture, so the flow is that
  // single step and its Continue commits.
  //
  // Memoised on the three flags it derives from, so `steps` — and the two
  // navigation callbacks that close over it — keep a stable identity. A fresh
  // array on every render would make `goNext` a new function each time, and
  // the entrance step depends on that identity inside an effect.
  const { searchAvailable, photoMode, streetViewOffered } = flow;
  const steps: KYCStep[] = useMemo(
    () =>
      isBusiness
        ? ['address-collection']
        : addressFlowSteps({ searchAvailable, photoMode, streetViewOffered }),
    [isBusiness, searchAvailable, photoMode, streetViewOffered],
  );

  // A resumed attempt restores the step it was saved on, and the flow may have
  // changed shape since: `searchAvailable` is a SERVER flag that lands after the
  // restore, and a republish can drop the entrance photo. Left alone the
  // applicant sits on a screen the order does not contain, where Continue has
  // nothing to advance to and Back has no predecessor. Gated on the config
  // having settled: until then the order is not the real one.
  const configSettled = useKyc((s) => s.serverConfig.status !== 'loading');
  const currentStep = useKyc((s) => s.currentStep);
  useEffect(() => {
    if (!configSettled || !isAddressStep(currentStep)) return;
    const options = stepOrderOptions(store.getState());
    const inFlow = buildStepOrder(options).filter(isAddressStep);
    const exit = addressExitStep(buildStepOrder({ ...options, hasAddressCollection: true }));
    const recovered = recoverAddressStep(currentStep, inFlow, exit);
    if (recovered) store.getState().goToStep(recovered);
  }, [configSettled, currentStep, store]);

  // The address scope declares the visitor's IP country by default, ONCE,
  // while nothing is declared; a geocode or a picked address then corrects
  // the guess (lib/country-adoption.ts). A full flow never defaults from it.
  const geoCountry = useKyc((s) => s.serverConfig.geoCountry ?? null);
  useEffect(() => {
    const s = store.getState();
    const country = geoDefaultCountry({
      geoCountry,
      selectedCountry: s.selectedCountry,
      scope: configScope(s.config),
      accepted: s.config.proofOfAddress?.countries,
    });
    if (country) s.setCountryAuto(country);
  }, [geoCountry, store]);

  const pin = address ? { lat: address.lat, lng: address.lng } : null;
  const country = isBusiness ? (businessCountry ?? undefined) : (selectedCountry ?? config.country);
  const view = defaultMapView(country);

  const pinActions = usePinActions(store, setError);

  /** Leave the address flow forwards: after the review, a KYB commit, a skip. */
  const exitForward = useCallback(() => {
    const state = store.getState();
    const last = steps[steps.length - 1]!;
    store.getState().goToStep(nextStepInOrder(last, stepOrderOptions(state)));
  }, [steps, store]);

  /**
   * The step after the current one within the flow, else the flow's exit:
   * exactly what the store's own `nextStep` computes, since the flow's steps
   * are contiguous in the ordered list. Going through the store also keeps
   * the navigation direction and the camera flag handled in one place.
   */
  const goNext = useCallback(() => store.getState().nextStep(), [store]);

  const pickPhoto = useCallback(
    async (upload: () => Promise<string>, previewUri: string) => {
      setError(null);
      setUploading(true);
      try {
        const mediaId = await upload();
        store.getState().setAddressPhoto(mediaId);
        store.getState().setAddressPhotoPreview(previewUri);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Upload failed. Please check your connection and try again.',
        );
      } finally {
        setUploading(false);
      }
    },
    [store],
  );

  const removePhoto = useCallback(() => {
    store.getState().setAddressPhoto(null);
    store.getState().setAddressPhotoPreview(null);
  }, [store]);

  /** Commit: the one-shot attest fix (best-effort), then leave the flow. */
  const confirm = useCallback(async () => {
    const current = store.getState().address;
    if (!current) return;
    setConfirming(true);
    let committed: AddressState = current;
    if (cfg?.attestPresence) {
      // Best-effort by contract: a denied prompt or a slow read costs the
      // `attested` tier, never the flow.
      committed = { ...current, ...(await deviceFixFields()) };
      store.getState().setAddress(committed);
    }
    // Presence verification keeps the confirmed pin ON-DEVICE so later
    // foreground reports evaluate the fence locally. Keyed by the org's user
    // reference: without one there is nothing to report against.
    if (cfg?.presence?.enabled === true && config.userId) {
      savePresencePin(
        config.userId,
        { lat: committed.lat, lng: committed.lng },
        { alwaysOn: cfg.presence.alwaysOn === true },
      );
    }
    setConfirming(false);
    exitForward();
  }, [cfg?.attestPresence, cfg?.presence?.enabled, config.userId, exitForward, store]);

  return {
    cfg,
    address,
    isBusiness,
    steps,
    pin,
    view,
    country,
    photoMode: flow.photoMode,
    streetViewOffered: flow.streetViewOffered,
    searchAvailable: flow.searchAvailable,
    uploading,
    confirming,
    error,
    setError,
    pickPhoto,
    removePhoto,
    goNext,
    exitForward,
    confirm,
    ...pinActions,
  };
}
