// ---------------------------------------------------------------------------
// Address Intelligence — the pure half.
//
// A smart address is a map pin (+ optional door photo and directions) the
// server corroborates against the evidence it already holds. The result is a
// SOFT sub-result: it never changes the verification's own status, it feeds
// decisioning. So nothing here should block a user beyond what the config
// explicitly requires (`requirePin`, required photo/directions).
//
// Mirrors the web SDK's address handling — keep the two in lockstep.
// ---------------------------------------------------------------------------

import { addressFlowOptions, type AddressFlowOptions } from '../lib/address-flow';
import { requiredPrefillSubmission } from '../lib/address-field-modes';
import { isBusinessFlow } from './business';
import type { SubjectType, WorkflowBusinessConfig } from '../types/business';
import type { AddressCollectionConfig } from '../types/workflow';
import type { AddressState } from '../store/state';
import type { VerifyRequest } from '../services/api-verify-types';

export type AddressFieldMode = 'off' | 'optional' | 'required';

/** Whether the step is part of the flow. */
export function hasAddressCollectionStep(
  address: AddressCollectionConfig | undefined | null,
): boolean {
  return address?.enabled === true;
}

/**
 * Which address screens this flow has — ONE call, read by the step-order
 * builder AND by the address steps themselves, so the two can never disagree
 * about which screens exist.
 *
 * KYB collapses to the single premises step: the pin plus its directions ARE
 * the capture, and the business flow already has its own section rhythm.
 */
export function addressFlowFor(
  config: {
    subjectType?: SubjectType;
    business?: WorkflowBusinessConfig;
    addressCollection?: AddressCollectionConfig;
  },
  /** The server offers a forward-search backend. */
  serverSearch: boolean,
  /** SANDBOX keys stub the vendor surfaces (addressVendorsStubbed). */
  stubbed = false,
  /** A maps frame URL this install can render (a WebView is installed): the
   *  framed street-view page carries the panorama for it. */
  hasStreetViewFrame = false,
): AddressFlowOptions {
  if (isBusinessFlow(config)) {
    return { searchAvailable: false, photoMode: 'off', streetViewOffered: false };
  }
  return addressFlowOptions({
    photo: config.addressCollection?.photo,
    streetView: config.addressCollection?.streetView,
    serverSearch: serverSearch && !stubbed,
    // The builder's live preview and the in-document Google key are web-only
    // surfaces, so neither flag can ever be true here. Passing them
    // explicitly keeps the rule a mirror.
    previewMode: false,
    hasGoogleKey: false,
    hasStreetViewFrame,
  });
}

// The old single-screen Continue gate (canContinueAddress and the two mode
// helpers that fed it) was deleted with the four-step flow: each step now
// gates itself, and a helper stating the old combined rule is a trap for
// whoever wires it back up. The Flutter port removed its copies for the same
// reason.

/**
 * The wire block. `config` is the flow's address step: a workflow-REQUIRED
 * field the applicant left on its map prefill rides that prefill (they saw
 * it filled and confirmed by continuing, and the server 422s a required
 * field that never arrives). Session progress passes no config and stays
 * raw, so a resume never confuses a prefill with a claim.
 */
export function addressPayload(
  address: AddressState,
  config?: AddressCollectionConfig | null,
): NonNullable<VerifyRequest['address']> {
  return {
    lat: address.lat,
    lng: address.lng,
    // The line the applicant CONFIRMED: the server prefers it over its own
    // reverse geocode, whose coverage drops whole streets in our markets.
    ...(address.label?.trim() ? { label: address.label.trim() } : {}),
    ...(typeof address.accuracy === 'number' ? { accuracy: address.accuracy } : {}),
    ...(address.directions.trim() ? { directions: address.directions.trim() } : {}),
    ...(address.propertyName.trim() ? { propertyName: address.propertyName.trim() } : {}),
    ...(address.propertyNumber.trim() ? { propertyNumber: address.propertyNumber.trim() } : {}),
    ...(address.street?.trim() ? { street: address.street.trim() } : {}),
    // The rest of the edit-details form — claims, sent only when typed.
    ...(address.unit?.trim() ? { unit: address.unit.trim() } : {}),
    ...(address.neighbourhood?.trim() ? { neighbourhood: address.neighbourhood.trim() } : {}),
    ...(address.city?.trim() ? { city: address.city.trim() } : {}),
    ...(address.state?.trim() ? { state: address.state.trim() } : {}),
    ...(address.postcode?.trim() ? { postcode: address.postcode.trim() } : {}),
    // Required-but-untouched prefills, LAST among the typed fields: the helper
    // never carries a typed value, so nothing above is overridden.
    ...requiredPrefillSubmission(config, address),
    ...(address.streetView ? { streetView: address.streetView } : {}),
    ...(typeof address.deviceLat === 'number' && typeof address.deviceLng === 'number'
      ? {
          deviceLat: address.deviceLat,
          deviceLng: address.deviceLng,
          ...(typeof address.deviceAccuracy === 'number'
            ? { deviceAccuracy: address.deviceAccuracy }
            : {}),
          ...(address.capturedAt ? { capturedAt: address.capturedAt } : {}),
        }
      : {}),
  };
}

/** Accepted door-photo types — an image, never a PDF. */
export const ADDRESS_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function isAcceptedAddressPhotoMimeType(mimeType: string | undefined): boolean {
  const base = (mimeType?.split(';')[0] ?? '').trim().toLowerCase();
  return (ADDRESS_PHOTO_MIME_TYPES as readonly string[]).includes(base);
}
