import { buildConsentModel } from '../screens/consent/model';
import type { MyazaKYCConfig } from '../types/config';

// ---------------------------------------------------------------------------
// The consent screen's copy is a LEGAL NOTICE derived from what the flow
// actually does. These tests pin the derivations that carry risk: a business
// flow must never show the identity step list (it claims steps that don't
// run), and the biometric sentence must never overclaim (facial recognition
// on a flow with no face capture) or underclaim (recording without saying so).
// Mirrors the web SDK's consent-disclosure tests.
// ---------------------------------------------------------------------------

const base = { apiKey: 'pk_test_x', country: 'NG' } as MyazaKYCConfig;

const labels = (config: MyazaKYCConfig) => buildConsentModel(config).steps.map((s) => s.label);

describe('individual flow', () => {
  it('defaults to the identity copy with document + selfie rows', () => {
    const m = buildConsentModel(base);
    expect(m.isBusiness).toBe(false);
    expect(m.title).toBe('Identity Verification');
    expect(m.description).toMatch(/verify your identity/);
    expect(labels(base)).toEqual([
      'Verify your government-issued ID',
      'Collect basic personal information',
      'Capture a photo of your ID document',
      'Take a selfie for facial verification',
    ]);
    expect(m.capturesFace).toBe(true);
    expect(m.recordsVideo).toBe(true);
  });

  it('greets by first name and drops disabled capture rows', () => {
    const config = {
      ...base,
      userData: { firstName: 'Ada' },
      enableSelfie: false,
      enableDocumentCapture: false,
    } as MyazaKYCConfig;
    const m = buildConsentModel(config);
    expect(m.title).toBe('Welcome, Ada');
    expect(labels(config)).toHaveLength(2);
    // No face capture and no document video — the notice must not claim either.
    expect(m.capturesFace).toBe(false);
    expect(m.recordsVideo).toBe(false);
  });

  it('lists the NFC chip row only when the flow enables it', () => {
    const config = { ...base, nfc: { enabled: true } } as MyazaKYCConfig;
    expect(labels(config)).toContain('Scan your document’s security chip (NFC)');
    expect(labels(base)).not.toContain('Scan your document’s security chip (NFC)');
  });

  it('lists the contact-code row, naming the channel it will actually use', () => {
    const config = { ...base, emailVerification: { enabled: true } } as MyazaKYCConfig;
    // Channel-specific: "contact details" promised both when only one runs.
    expect(labels(config)).toContain('Confirm your email with a one-time code');
    const both = {
      ...base,
      emailVerification: { enabled: true },
      phoneVerification: { enabled: true },
    } as MyazaKYCConfig;
    expect(labels(both)).toContain('Confirm your email and phone number with a one-time code');
    expect(labels(base)).not.toContain('Confirm your contact details with a one-time code');
  });
});

describe('business (KYB) flow', () => {
  const business = (extra?: object): MyazaKYCConfig =>
    ({
      ...base,
      subjectType: 'business',
      business: { country: 'NG', ...extra },
    }) as MyazaKYCConfig;

  it('shows the business copy, never the identity step list', () => {
    const m = buildConsentModel(business());
    expect(m.isBusiness).toBe(true);
    expect(m.title).toBe('Business Verification');
    expect(m.description).toMatch(/verify your business/);
    expect(labels(business())).toEqual([
      'Collect your business registration details',
      'Verify your business against the official registry',
    ]);
  });

  it('adds the application rows the workflow actually configures', () => {
    const config = business({
      keyPeople: { enabled: true, collect: true },
      documents: { enabled: true },
      applicant: { verification: true },
    });
    expect(labels(config)).toEqual([
      'Collect your business registration details',
      'Verify your business against the official registry',
      "List the company's directors and owners",
      'Upload supporting business documents',
      'Verify your own identity',
    ]);
  });

  it('claims a face capture ONLY when the applicant verifies in-flow', () => {
    // A pure registry lookup captures nothing — claiming facial recognition
    // (or recording) there would be a false statement in a legal notice.
    const lookup = buildConsentModel(business());
    expect(lookup.capturesFace).toBe(false);
    expect(lookup.recordsVideo).toBe(false);

    const withApplicant = buildConsentModel(business({ applicant: { verification: true } }));
    expect(withApplicant.capturesFace).toBe(true);
    expect(withApplicant.recordsVideo).toBe(true);
  });

  it('fills the {businessName} token in workflow consent copy', () => {
    const config = {
      ...business(),
      userData: { businessName: 'Acme Ltd' },
      consent: { title: 'Verify {businessName}' },
    } as MyazaKYCConfig;
    expect(buildConsentModel(config).title).toBe('Verify Acme Ltd');
  });
});

describe('address scope bullets follow the evidence the flow asks for', () => {
  const addressScope = (over: Record<string, unknown>) =>
    ({ ...base, scope: 'address', ...over }) as MyazaKYCConfig;

  it('promises no map when the flow only asks for a document', () => {
    // The bullets were a fixed pair assuming the pin, so a proof-of-address
    // only flow told the applicant it would put them on a map and ask for
    // details it never collects. A consent notice may not promise a step the
    // flow does not run.
    const list = labels(addressScope({ proofOfAddress: { enabled: true } }));
    expect(list).toContain('Upload a proof of address document');
    expect(list.join(' ')).not.toContain('map');
    expect(list.join(' ')).not.toContain('only you can know');
  });

  it('promises the map when the flow collects a pin', () => {
    const list = labels(addressScope({ addressCollection: { enabled: true } }));
    expect(list).toContain('Pin your home address on a map');
    expect(list).toContain('Confirm the details only you can know');
    expect(list).not.toContain('Upload a proof of address document');
  });

  it('promises both when the flow asks for both', () => {
    const list = labels(
      addressScope({ addressCollection: { enabled: true }, proofOfAddress: { enabled: true } }),
    );
    expect(list).toContain('Pin your home address on a map');
    expect(list).toContain('Upload a proof of address document');
    // The map bullet is not repeated by the generic post-capture push.
    expect(list.filter((l) => l.includes('map'))).toHaveLength(1);
  });
});

