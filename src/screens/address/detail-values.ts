import type { AddressState } from '../../store/state';
import type { DetailValues } from './DetailsSheetFields';

/**
 * The details-sheet values of an address, in the sheet's own shape: the
 * property fields as '' when absent, the area fields as undefined when never
 * touched (so the map's prefill shows) and '' when deliberately cleared.
 * Shared by the pin step (sheet + summary row) so the two never disagree.
 */
export function detailValuesOf(address: AddressState | null | undefined): DetailValues {
  return {
    propertyNumber: address?.propertyNumber ?? '',
    street: address?.street,
    unit: address?.unit,
    propertyName: address?.propertyName ?? '',
    directions: address?.directions ?? '',
    neighbourhood: address?.neighbourhood,
    city: address?.city,
    state: address?.state,
    postcode: address?.postcode,
  };
}
