import React, { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { spacing } from '../../config/theme';
import { useKyc, useKycStore, useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { MyazaButton } from '../../components/MyazaButton';
import { FramedMapPicker } from '../../components/FramedMapPicker';
import { StickyActions } from '../../components/StickyActions';
import { displayAddressLine, shouldAskLabelDecision, addressVendorsStubbed } from '../../lib/address-flow';
import { missingFieldsNudge, missingRequiredAddressFields } from '../../lib/address-field-modes';
import { claimAutoLocate } from '../../lib/address-current-location';
import { mapSurfaceHeight } from '../../lib/map-tiles';
import { useAddressFlow } from './use-address-flow';
import { AddressMapStub } from './AddressMapStub';
import { useAddressIntroGate } from './AddressIntroGate';
import { CurrentLocationRow, LocateChip } from './CurrentLocationRow';
import { LabelDecisionRow } from './LabelDecisionRow';
import { DetailsSheet } from './DetailsSheet';
import { detailValuesOf } from './detail-values';
import { PinSummaryRow } from './PinSummaryRow';
import { SkipForNow } from './SkipForNow';

/**
 * The PIN step (wire name 'address-collection', kept so older session progress
 * restores cleanly and the server's step-log titles stay meaningful).
 *
 * A big map — sized by mapSurfaceHeight, so a phone keeps room to scroll —
 * with the summary row and the details sheet beneath it, and Continue held at
 * the bottom edge (StickyActions) so the map can never put it out of reach.
 * On KYB this is the WHOLE premises capture, so Continue commits (attest fix
 * included); on an individual flow it advances to the entrance and review
 * steps. Workflow-required details hold Continue and open the sheet on the
 * missing fields rather than pointing at a closed drawer.
 */
export function AddressPinStep(): React.ReactElement {
  const store = useKycStore();
  const { colors } = useTheme();
  const viewport = useWindowDimensions();
  const flow = useAddressFlow();
  // The framed Google picker when the platform serves one; the OSM picker
  // otherwise (and whenever the page never says ready).
  const mapsFrameUrl = useKyc((s) => s.serverConfig.mapsFrameUrl ?? null);
  // SANDBOX renders the stand-in (the web SDK's vendor-stub rule): verdicts
  // are canned server-side, so a live map on a test key only spends quota.
  const vendorsStubbed = addressVendorsStubbed({
    environment: useKyc((s) => s.serverConfig.environment ?? null),
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [missingNudge, setMissingNudge] = useState(false);
  const gate = useAddressIntroGate('address-collection', flow.steps[0]!);

  const gateShowing = Boolean(gate);
  const noPin = !flow.pin;
  const { startPrefetch, relabelPin, applyCurrentFix } = flow;
  useEffect(() => {
    // The fix warms even under the primer: only the APPLY waits for it, since
    // a pin landing behind the gate would be invisible anyway.
    startPrefetch();
    if (gateShowing) return;
    // A restored pin without its line (a snapshot saved before labels existed):
    // reverse-geocode it once rather than showing raw coordinates.
    relabelPin();
    // Most people are verifying from home, so the map should land on them
    // rather than a country-centre default. Silent by contract, and claimed
    // once per verification: a dismissed or denied prompt must not re-fire
    // every time the person passes back through this step.
    if (!noPin || !claimAutoLocate()) return;
    void applyCurrentFix(undefined, { silent: true });
  }, [gateShowing, noPin, startPrefetch, relabelPin, applyCurrentFix]);

  if (gate) return gate;



  const address = flow.address;
  const label = address?.label ?? null;
  const askLabel = address ? shouldAskLabelDecision(address) : false;
  // The pin step is the last of the flow on KYB, so its Continue commits.
  const lastInFlow = flow.isBusiness;
  const mapHeight = mapSurfaceHeight(viewport);

  const missingRequired = missingRequiredAddressFields(flow.cfg, address);
  const handleContinue = () => {
    if (missingRequired.length > 0) {
      setMissingNudge(true);
      setSheetOpen(true);
      return;
    }
    if (lastInFlow) void flow.confirm();
    else flow.goNext();
  };

  return (
    <>
      <StickyActions
        actions={
          <>
            <MyazaButton
              label="Continue"
              loading={flow.confirming}
              disabled={!flow.pin}
              onPress={handleContinue}
            />
            <SkipForNow requirePin={flow.cfg?.requirePin} onPress={flow.exitForward} />
          </>
        }
      >
        <View>
          {vendorsStubbed ? (
            <AddressMapStub hasPin={Boolean(flow.pin)} onLand={(next) => flow.setPin(next)} defaultCenter={flow.view.center} height={mapHeight} />
          ) : (
            <FramedMapPicker
              frameUrl={mapsFrameUrl}
              value={flow.pin}
              onChange={(next) => flow.setPin(next)}
              defaultCenter={flow.view.center}
              defaultZoom={flow.view.zoom}
              height={mapHeight}
            />
          )}
          {flow.pin ? <LocateChip locating={flow.locating} onPress={() => void flow.locateToPin()} /> : null}
        </View>

        <View style={{ height: spacing.md }} />
        <PinSummaryRow
          line={address ? displayAddressLine(address) : null}
          labelling={flow.labelling}
          values={detailValuesOf(address)}
          disabled={!flow.pin}
          onPress={() => setSheetOpen(true)}
        />

        {askLabel && label ? (
          <>
            <View style={{ height: spacing.md }} />
            <LabelDecisionRow label={label} onKeep={flow.keepPickedLabel} onAdopt={flow.adoptPinAddress} />
          </>
        ) : null}

        {flow.pin ? null : (
          <>
            <View style={{ height: spacing.md }} />
            <CurrentLocationRow hint={flow.currentFix?.label ?? null} locating={flow.locating} onPress={() => void flow.applyCurrentFix()} />
          </>
        )}

        {flow.error ? (
          <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.sm }}>
            {flow.error}
          </MyazaText>
        ) : null}
        {missingNudge && missingRequired.length > 0 ? (
          <MyazaText variant="bodySmall" color={colors.error} style={{ marginTop: spacing.sm }}>
            {missingFieldsNudge(missingRequired)}
          </MyazaText>
        ) : null}
      </StickyActions>

      {sheetOpen ? (
        <DetailsSheet
          isBusiness={flow.isBusiness}
          parts={address?.parts ?? null}
          country={flow.country ?? null}
          directionsRequired={flow.cfg?.directions === 'required'}
          addressConfig={flow.cfg}
          values={detailValuesOf(address)}
          disabled={!flow.pin}
          onChange={(patch) => {
            const current = store.getState().address;
            if (current) store.getState().setAddress({ ...current, ...patch });
          }}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </>
  );
}
