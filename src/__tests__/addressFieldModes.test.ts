import { readFileSync } from 'fs';
import { join } from 'path';

import {
  ADDRESS_FIELD_KEYS,
  addressFieldModes,
  missingFieldsNudge,
  missingRequiredAddressFields,
  requiredPrefillSubmission,
} from '../lib/address-field-modes';
import { addressPayload } from '../config/addressCollection';
import type { AddressState } from '../store/state';
import type { AddressCollectionConfig } from '../types/workflow';

// ─── Per-field address modes, replayed from the SHARED vector file ───────────
//
// The rule lives in three mirrors (web, RN, Flutter) and on the server; the
// vectors are the one place it is written down as data, so a drift in any
// mirror fails here rather than as a 422 on an applicant's last screen.

interface Vector {
  name: string;
  config: AddressCollectionConfig | null;
  typed: Record<string, string>;
  expectModes: Record<string, string>;
  expectMissing: string[];
  expectPrefill: Record<string, string>;
}

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../kyc-sdk-flutter/test/address_field_modes_vectors.json'),
    'utf8',
  ),
) as { address: Record<string, unknown>; vectors: Vector[] };

const address = (typed: Record<string, string>): AddressState =>
  ({ ...vectors.address, ...typed }) as unknown as AddressState;

describe('address field modes (shared vectors)', () => {
  it.each(vectors.vectors.map((v) => [v.name, v] as const))('%s', (_name, v) => {
    const modes = addressFieldModes(v.config);
    for (const [key, mode] of Object.entries(v.expectModes)) {
      expect(modes[key as (typeof ADDRESS_FIELD_KEYS)[number]]).toBe(mode);
    }
    expect(missingRequiredAddressFields(v.config, address(v.typed))).toEqual(v.expectMissing);
    expect(requiredPrefillSubmission(v.config, address(v.typed))).toEqual(v.expectPrefill);
  });

  it('holds every key the server knows', () => {
    expect([...ADDRESS_FIELD_KEYS]).toEqual([
      'propertyName',
      'propertyNumber',
      'street',
      'unit',
      'neighbourhood',
      'city',
      'state',
      'postcode',
    ]);
  });

  it('names the missing fields in the nudge, in lower case, with no em dash', () => {
    const nudge = missingFieldsNudge(['propertyNumber', 'city']);
    expect(nudge).toBe('This flow needs: house or flat number, city.');
    expect(nudge).not.toContain('—');
  });
});

describe('addressPayload with the flow config', () => {
  const base = address({});

  it('submits the displayed prefill of a required field the applicant left untouched', () => {
    const payload = addressPayload(base, { fields: { city: 'required' } });
    expect(payload.city).toBe('Calabar');
    // Optional prefills stay off the wire: only what was typed or required.
    expect(payload).not.toHaveProperty('state');
  });

  it('lets a typed value win over the prefill', () => {
    const payload = addressPayload(address({ city: ' Uyo ' }), { fields: { city: 'required' } });
    expect(payload.city).toBe('Uyo');
  });

  it('adds nothing without a config, and keeps the prefill ahead of the frame', () => {
    expect(addressPayload(base)).not.toHaveProperty('city');
    const withFrame = addressPayload(
      { ...base, streetView: { panoId: 'p', heading: 1, pitch: 2, fov: 90 } } as AddressState,
      { fields: { city: 'required' } },
    );
    const keys = Object.keys(withFrame);
    expect(keys.indexOf('city')).toBeLessThan(keys.indexOf('streetView'));
  });
});

describe('the submission passes the flow config to the payload builder', () => {
  it('is pinned at the source: a bare addressPayload(state.address) would drop every required prefill', () => {
    const submit = readFileSync(join(__dirname, '../store/submit.ts'), 'utf8');
    expect(submit).toMatch(/addressPayload\(state\.address,\s*state\.config\.addressCollection\)/);
  });
});
