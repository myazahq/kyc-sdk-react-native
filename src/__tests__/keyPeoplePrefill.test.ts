import { prefillKeyPeople, shouldPrefill, roleFromDesignation } from '../config/keyPeoplePrefill';
import { emptyKeyPerson } from '../config/keyPeople';

const FLITSTACK = [
  { name: 'MBOTO IBI', designation: 'PRESENTER' },
  { name: 'Atambi Tony Joseph', designation: 'WITNESS' },
  { name: 'Archibong Bassey Charles', designation: 'DIRECTOR' },
  { name: 'Archibong Bassey Charles', designation: 'SHAREHOLDER' },
  { name: 'Ingwe Unimke Richard', designation: 'DIRECTOR' },
  { name: 'Ingwe Unimke Richard', designation: 'PERSONS WITH SIGNIFICANT CONTROL' },
];

describe('prefillKeyPeople', () => {
  it('offers one row per person and drops the filing agent and witness', () => {
    const rows = prefillKeyPeople(FLITSTACK, 'NG');
    expect(rows.map((r) => r.name)).toEqual(['Archibong Bassey Charles', 'Ingwe Unimke Richard']);
  });

  it('keeps the classification that asks the most of them', () => {
    const [, richard] = prefillKeyPeople(FLITSTACK, 'NG');
    expect(richard!.role).toBe('beneficial_owner');
  });

  it('never merges siblings who share a double-barrelled surname', () => {
    const rows = prefillKeyPeople(
      [
        { name: 'Amara Sandbox-Parent', designation: 'SHAREHOLDER' },
        { name: 'Femi Sandbox-Parent', designation: 'DIRECTOR' },
      ],
      'NG',
    );
    expect(rows).toHaveLength(2);
  });

  it('marks a corporate shareholder as a company', () => {
    const [row] = prefillKeyPeople([{ name: 'Acme Holdings Ltd', designation: 'SHAREHOLDER' }], 'NG');
    expect(row!.isCorporate).toBe(true);
  });
});

describe('shouldPrefill', () => {
  it('only ever fills an empty list', () => {
    expect(shouldPrefill([])).toBe(true);
    expect(shouldPrefill([emptyKeyPerson()])).toBe(true);
    expect(shouldPrefill([{ ...emptyKeyPerson(), name: 'Someone Typed' }])).toBe(false);
  });
});

describe('roleFromDesignation', () => {
  it('reads Nigeria significant-control entries as beneficial ownership', () => {
    expect(roleFromDesignation('PERSONS WITH SIGNIFICANT CONTROL')).toBe('beneficial_owner');
    expect(roleFromDesignation('PSC')).toBe('beneficial_owner');
  });
});
