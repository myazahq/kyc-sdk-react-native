import {
  addressFlowOptions,
  addressFlowSteps,
  addressVendorsStubbed,
  nextAddressStep,
  prevAddressStep,
} from '../lib/address-flow';
import { addressFlowFor } from '../config/addressCollection';

// Which address screens a flow HAS, and how it walks them. The label and
// address-line rules that share address-flow.ts are covered next door in
// addressLabel.test.ts (200-line rule).
//
// A MIRROR of the web SDK's steps/address/flow-steps.test.ts — the same cases
// with the same expected answers, because a rule that drifts between platforms
// strands an applicant on one of them.

describe('addressFlowSteps', () => {
  it('is pin + review at minimum', () => {
    expect(
      addressFlowSteps({ searchAvailable: false, photoMode: 'off', streetViewOffered: false }),
    ).toEqual(['address-collection', 'address-review']);
  });

  it('adds search when a backend is available', () => {
    expect(
      addressFlowSteps({ searchAvailable: true, photoMode: 'off', streetViewOffered: false })[0],
    ).toBe('address-search');
  });

  it('adds the entrance step for a photo mode OR street view', () => {
    expect(
      addressFlowSteps({ searchAvailable: false, photoMode: 'optional', streetViewOffered: false }),
    ).toContain('address-entrance');
    expect(
      addressFlowSteps({ searchAvailable: false, photoMode: 'off', streetViewOffered: true }),
    ).toContain('address-entrance');
  });

  it('walks forward and back within the flow, null at the edges', () => {
    const steps = addressFlowSteps({
      searchAvailable: true,
      photoMode: 'optional',
      streetViewOffered: true,
    });
    expect(nextAddressStep(steps, 'address-search')).toBe('address-collection');
    expect(nextAddressStep(steps, 'address-review')).toBeNull();
    expect(prevAddressStep(steps, 'address-collection')).toBe('address-search');
    expect(prevAddressStep(steps, 'address-search')).toBeNull();
  });
});

describe('addressFlowOptions', () => {
  it('defaults the photo mode to optional and hides search in preview', () => {
    expect(
      addressFlowOptions({ serverSearch: true, previewMode: true, hasGoogleKey: false, hasStreetViewFrame: false }),
    ).toEqual({ searchAvailable: false, photoMode: 'optional', streetViewOffered: false });
  });

  it('never offers Street View without a key, whatever the workflow asked for', () => {
    // Mobile has no panorama widget, so the call site passes hasGoogleKey false
    // and this is the only answer the flow can ever get.
    expect(
      addressFlowOptions({
        streetView: 'optional',
        serverSearch: true,
        previewMode: false,
        hasGoogleKey: false, hasStreetViewFrame: false,
      }).streetViewOffered,
    ).toBe(false);
  });
});

describe('addressVendorsStubbed', () => {
  it('stubs SANDBOX only — development stays real', () => {
    expect(addressVendorsStubbed({ environment: 'SANDBOX' })).toBe(true);
    // The dev-is-real rule: a development key exercises the live surfaces.
    expect(addressVendorsStubbed({ environment: 'DEVELOPMENT' })).toBe(false);
    expect(addressVendorsStubbed({ environment: 'PRODUCTION' })).toBe(false);
    // An unknown or absent environment counts as live: a stub is only ever
    // reached on positive evidence that this is a test key.
    expect(addressVendorsStubbed({ environment: null })).toBe(false);
    expect(addressVendorsStubbed({})).toBe(false);
  });

  it('a stubbed mount drops the search step', () => {
    // The wrapper ANDs the flag into serverSearch, because a search box
    // nothing can answer is worse than no step at all.
    const config = { addressCollection: { enabled: true } } as const;
    const stubbed = addressFlowFor(config, true, true);
    expect(stubbed.searchAvailable).toBe(false);
    expect(addressFlowSteps(stubbed)).not.toContain('address-search');

    const live = addressFlowFor(config, true, false);
    expect(live.searchAvailable).toBe(true);
    expect(addressFlowSteps(live)).toContain('address-search');
  });
});

describe('the framed street view offers the entrance step on mobile', () => {
  const base = { streetView: 'optional' as const, serverSearch: true, previewMode: false, hasGoogleKey: false };

  it('is offered when the server minted a maps frame this install can render', () => {
    expect(addressFlowOptions({ ...base, hasStreetViewFrame: true }).streetViewOffered).toBe(true);
    expect(addressFlowOptions({ ...base, hasStreetViewFrame: false }).streetViewOffered).toBe(false);
  });

  it('is never offered when the workflow opted out, whatever the platform has', () => {
    expect(addressFlowOptions({ ...base, streetView: 'off', hasStreetViewFrame: true }).streetViewOffered).toBe(false);
  });

  it('is offered for a required step too, with the photo still the fallback', () => {
    expect(addressFlowOptions({ ...base, streetView: 'required', hasStreetViewFrame: true }).streetViewOffered).toBe(true);
  });

  it('reaches the flow through addressFlowFor', () => {
    const config = { addressCollection: { enabled: true } };
    expect(addressFlowFor(config, true, false, true).streetViewOffered).toBe(true);
    expect(addressFlowFor(config, true, false, false).streetViewOffered).toBe(false);
    expect(addressFlowFor(config, true, false).streetViewOffered).toBe(false);
  });
});
