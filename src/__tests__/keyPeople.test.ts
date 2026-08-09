import {
  emptyKeyPerson,
  invalidKeyPersonRows,
  isKeyPersonRowBlank,
  isKeyPersonRowValid,
  keyPeoplePayload,
  splitFullName,
  type KeyPersonEntry,
} from '../config/keyPeople';

// ─── Applicant-declared key people ────────────────────────────────────────────
//
// The server reconciles what the applicant types against what the registry
// names, and someone the applicant OMITTED who the registry then discloses is
// flagged as a risk signal. So a half-typed row must not silently become a
// disclosed person, and a valid one must not silently be dropped.

const row = (over: Partial<KeyPersonEntry> = {}): KeyPersonEntry => ({
  ...emptyKeyPerson(),
  name: 'Chidi Okafor',
  ...over,
});

describe('row validity', () => {
  it('accepts a name and a role', () => {
    expect(isKeyPersonRowValid(row())).toBe(true);
  });

  it('needs a real name', () => {
    expect(isKeyPersonRowValid(row({ name: '' }))).toBe(false);
    expect(isKeyPersonRowValid(row({ name: 'A' }))).toBe(false);
    expect(isKeyPersonRowValid(row({ name: '   ' }))).toBe(false);
  });

  it('validates an email only when one was typed', () => {
    // The address is optional — it exists to auto-send that person's link — so
    // leaving it blank must not block the row.
    expect(isKeyPersonRowValid(row({ email: '' }))).toBe(true);
    expect(isKeyPersonRowValid(row({ email: 'not-an-email' }))).toBe(false);
    expect(isKeyPersonRowValid(row({ email: 'ubo@example.com' }))).toBe(true);
  });

  it('validates ownership only when one was typed', () => {
    expect(isKeyPersonRowValid(row({ ownershipPct: '' }))).toBe(true);
    expect(isKeyPersonRowValid(row({ ownershipPct: '60' }))).toBe(true);
    expect(isKeyPersonRowValid(row({ ownershipPct: '101' }))).toBe(false);
    expect(isKeyPersonRowValid(row({ ownershipPct: '-1' }))).toBe(false);
    expect(isKeyPersonRowValid(row({ ownershipPct: 'most of it' }))).toBe(false);
  });
});

describe('abandoned rows', () => {
  it('recognises a row nobody has touched', () => {
    expect(isKeyPersonRowBlank(emptyKeyPerson())).toBe(true);
  });

  it('does not treat a started row as blank', () => {
    expect(isKeyPersonRowBlank(row({ name: 'Ch' }))).toBe(false);
  });

  it('blocks only rows that were STARTED and left broken', () => {
    // Tapping "Add a person" and changing your mind must not strand the user
    // on a form they cannot submit — but a half-typed person must not slip
    // through as a disclosure either.
    const rows = [row(), emptyKeyPerson(), row({ name: 'X' })];
    expect(invalidKeyPersonRows(rows)).toEqual([2]);
  });
});

describe('the submitted payload', () => {
  it('drops rows that were never completed', () => {
    expect(keyPeoplePayload([row(), emptyKeyPerson()])).toHaveLength(1);
  });

  it('sends ownership as a number', () => {
    // A threshold rule (shareholders at/above 25% become UBOs) compares
    // numerically; a string fails that comparison closed.
    expect(keyPeoplePayload([row({ ownershipPct: '60' })])[0]!.ownershipPct).toBe(60);
  });

  it('normalises the country to upper case', () => {
    expect(keyPeoplePayload([row({ country: 'ng' })])[0]!.country).toBe('NG');
  });

  it('omits the optional fields that were left blank', () => {
    // An empty string is not "no email" to a server that will try to send to it.
    const payload = keyPeoplePayload([row()])[0]!;
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('country');
    expect(payload).not.toHaveProperty('ownershipPct');
  });

  it("caps at the server's limit rather than being rejected wholesale", () => {
    const many = Array.from({ length: 25 }, (_, i) => row({ name: `Person ${i}` }));
    expect(keyPeoplePayload(many)).toHaveLength(20);
  });

  it('trims what the user typed', () => {
    const payload = keyPeoplePayload([row({ name: '  Chidi Okafor  ', email: ' ubo@x.co ' })])[0]!;
    expect(payload.name).toBe('Chidi Okafor');
    expect(payload.email).toBe('ubo@x.co');
  });
});

describe('splitting a full name', () => {
  it('splits on the first space', () => {
    expect(splitFullName('Chidi Okafor')).toEqual({ firstName: 'Chidi', lastName: 'Okafor' });
  });

  it('keeps every remaining part as the surname', () => {
    expect(splitFullName('Ama Serwaa Boateng')).toEqual({
      firstName: 'Ama',
      lastName: 'Serwaa Boateng',
    });
  });

  it('handles a single name', () => {
    expect(splitFullName('Prince')).toEqual({ firstName: 'Prince' });
  });

  it('returns nothing for nothing', () => {
    expect(splitFullName('   ')).toBeUndefined();
  });
});
