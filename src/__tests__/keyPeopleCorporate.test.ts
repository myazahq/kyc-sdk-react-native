import { looksCorporate } from '../config/keyPeopleCorporate';
import { keyPeoplePayload, emptyKeyPerson } from '../config/keyPeople';

describe('looksCorporate', () => {
  it('recognises a company from a trailing designator', () => {
    expect(looksCorporate('Acme Holdings Ltd')).toBe(true);
    expect(looksCorporate('ACCESS HOLDINGS  PLC')).toBe(true);
  });

  it('leaves a person whose given name reads corporate alone', () => {
    // "Trust", "Grace" and "Precious" are ordinary Nigerian given names, so
    // only a designator at the END of a name counts.
    expect(looksCorporate('Trust Chukwu')).toBe(false);
    expect(looksCorporate('Bola Owner')).toBe(false);
  });
});

describe('keyPeoplePayload for a company', () => {
  const corp = {
    ...emptyKeyPerson('shareholder'),
    name: 'Acme Holdings Ltd',
    ownershipPct: '60',
    isCorporate: true,
    registrationNumber: 'RC123456',
    owners: [
      { name: 'Jane Doe', ownershipPct: '75', email: '', country: 'gb' },
      { name: '', ownershipPct: '', email: '', country: '' },
    ],
  };

  it('sends the company flag, its number, and its named owners', () => {
    expect(keyPeoplePayload([corp])[0]).toMatchObject({
      isCorporate: true,
      registrationNumber: 'RC123456',
      owners: [{ name: 'Jane Doe', ownershipPct: 75, country: 'GB' }],
    });
  });

  it('never sends the applicant themselves as a company', () => {
    // A company cannot be the person filling in the form.
    const row = keyPeoplePayload([{ ...corp, name: 'Ada Obi' }], 0)[0]!;
    expect(row).toMatchObject({ isApplicant: true });
    expect(row).not.toHaveProperty('isCorporate');
    expect(row).not.toHaveProperty('owners');
  });
});
