import { precisePositionOutcome } from '../../services/location';
import { addressVendorsStubbed, SAMPLE_ADDRESS_LINE } from '../../lib/address-flow';
import type { FixSource } from '../../lib/address-current-location';
import type { KycStore } from '../../store/state';

// ---------------------------------------------------------------------------
// What the current-location cache needs from the flow: the GPS reader and the
// reverse geocoder. SANDBOX stubs BOTH (the web SDK's vendor-stub rule): a
// canned fix with no permission prompt, and the sample label with no geocoder
// call — the server's sandbox verdicts are canned anyway. Split from
// use-pin-actions.ts (200-line rule).
// ---------------------------------------------------------------------------

export function fixSourceFor(store: KycStore): FixSource {
  const stubbed = (): boolean =>
    addressVendorsStubbed({ environment: store.getState().serverConfig.environment });
  return {
    takeFix: () =>
      stubbed()
        ? Promise.resolve({ fix: { lat: 6.4281, lng: 3.4219, accuracy: 15 } })
        : precisePositionOutcome(),
    addressReverse: (lat: number, lng: number) =>
      stubbed()
        ? Promise.resolve({ line: SAMPLE_ADDRESS_LINE, parts: null })
        : store.getState().api.addressReverse(lat, lng),
  };
}
