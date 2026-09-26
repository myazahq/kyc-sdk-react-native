import {
  addressPayload,
  hasAddressCollectionStep,
  isAcceptedAddressPhotoMimeType,
} from '../config/addressCollection';
import { buildStepOrder, type StepOrderOptions } from '../config/stepOrder';
import { WORKFLOW_KEYS } from '../config/workflowMerge';

// ─── Address Intelligence (smart-address capture) ────────────────────────────
//
// A map pin (+ optional door photo and directions) the server corroborates
// against the evidence it already holds. The result is SOFT — the client only
// collects; nothing here blocks beyond what the config explicitly requires.

const BASE: StepOrderOptions = {
  isBusiness: false,
  business: undefined,
  hasDocCapture: false,
  hasNfc: false,
  hasLiveness: true,
  hasCountrySelect: false,
  hasEmailVerification: false,
  hasPhoneVerification: false,
  hasPoa: false,
  hasSupportingDocuments: false,
  hasAddressCollection: false,
  hasQuestionnaire: false,
  resubmit: null,
};

describe('step presence', () => {
  it('needs an explicit enable', () => {
    expect(hasAddressCollectionStep({ enabled: true })).toBe(true);
    expect(hasAddressCollectionStep({})).toBe(false);
    expect(hasAddressCollectionStep(undefined)).toBe(false);
  });

  it('sits after Proof of Address, before the questionnaire', () => {
    const order = buildStepOrder({
      ...BASE,
      hasPoa: true,
      hasAddressCollection: true,
      hasQuestionnaire: true,
      addressFlow: { searchAvailable: true, photoMode: 'optional', streetViewOffered: false },
    });
    const poa = order.indexOf('proof-of-address');
    expect(poa).toBeGreaterThan(-1);
    // The whole flow lands between the two, in order.
    expect(order.slice(poa + 1)).toEqual([
      'address-search',
      'address-collection',
      'address-entrance',
      'address-review',
      'questionnaire',
      'submitted',
    ]);
  });

  it('drops the optional address screens the flow does not offer', () => {
    const order = buildStepOrder({
      ...BASE,
      hasAddressCollection: true,
      addressFlow: { searchAvailable: false, photoMode: 'off', streetViewOffered: false },
    });
    expect(order).not.toContain('address-search');
    expect(order).not.toContain('address-entrance');
    expect(order.indexOf('address-review')).toBe(order.indexOf('address-collection') + 1);
  });

  it('joins the KYB flow as the premises step, after business details', () => {
    const order = buildStepOrder({
      ...BASE,
      isBusiness: true,
      hasAddressCollection: true,
    });
    const details = order.indexOf('business-details');
    expect(order.indexOf('address-collection')).toBe(details + 1);
    // KYB collapses to that single step: the premises pin and its directions
    // ARE the capture, and the business flow has its own section rhythm.
    expect(order).not.toContain('address-search');
    expect(order).not.toContain('address-entrance');
    expect(order).not.toContain('address-review');
  });

  it('is a workflow-controllable key', () => {
    expect(WORKFLOW_KEYS).toContain('addressCollection');
  });
});

describe('wire payload', () => {
  it('carries only what was collected', () => {
    expect(
      addressPayload({
        lat: 6.4281,
        lng: 3.4219,
        accuracy: null,
        directions: '  ',
        propertyName: ' ',
        propertyNumber: '',
      }),
    ).toEqual({ lat: 6.4281, lng: 3.4219 });
  });

  it('carries the attest fix when one was taken', () => {
    expect(
      addressPayload({
        lat: 6.4281,
        lng: 3.4219,
        accuracy: 12,
        directions: 'black gate ',
        propertyName: ' Sunrise Villa ',
        propertyNumber: '11',
        deviceLat: 6.4283,
        deviceLng: 3.4217,
        deviceAccuracy: 20,
        capturedAt: '2026-08-25T00:00:00.000Z',
      }),
    ).toEqual({
      lat: 6.4281,
      lng: 3.4219,
      accuracy: 12,
      directions: 'black gate',
      propertyName: 'Sunrise Villa',
      propertyNumber: '11',
      deviceLat: 6.4283,
      deviceLng: 3.4217,
      deviceAccuracy: 20,
      capturedAt: '2026-08-25T00:00:00.000Z',
    });
  });
});

describe('door photo', () => {
  it('accepts images and never a PDF', () => {
    expect(isAcceptedAddressPhotoMimeType('image/jpeg')).toBe(true);
    expect(isAcceptedAddressPhotoMimeType('image/png; charset=binary')).toBe(true);
    expect(isAcceptedAddressPhotoMimeType('application/pdf')).toBe(false);
    expect(isAcceptedAddressPhotoMimeType(undefined)).toBe(false);
  });
});
