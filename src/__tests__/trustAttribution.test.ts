import {
  customLogoWidth,
  myazaProviderName,
  needsMyazaDisclosure,
  resolveTrustAttribution,
} from '../lib/trust-attribution';
import { consentLegalNotice, legalNoticeText } from '../screens/consent/legal';
import { normalizeBrandingUrls } from '../services/resolveUrl';

// ─── Footer attribution: Myaza Trust, or the org's own logo ──────────────────
//
// Mirrors the web SDK's trust-attribution tests. The server's answer is read
// defensively: anything that is not `custom` is Myaza, and a custom answer
// with a bad logo stays custom (the org asked for no Myaza mark).

const custom = { mode: 'custom', logo: 'https://cdn/logo.png', logoDark: 'https://cdn/dark.png', companyName: 'Acme' };

describe('resolveTrustAttribution', () => {
  it('reads a missing or older answer as Myaza', () => {
    expect(resolveTrustAttribution(undefined)).toEqual({ mode: 'myaza' });
    expect(resolveTrustAttribution(null)).toEqual({ mode: 'myaza' });
    expect(resolveTrustAttribution('custom')).toEqual({ mode: 'myaza' });
    expect(resolveTrustAttribution({ mode: 'myaza' })).toEqual({ mode: 'myaza' });
    expect(resolveTrustAttribution({ mode: 'somethingNew', logo: 'x' })).toEqual({ mode: 'myaza' });
  });

  it('uses the org logo, and the dark one on a dark flow', () => {
    expect(resolveTrustAttribution(custom)).toEqual({ mode: 'custom', logo: custom.logo, companyName: 'Acme' });
    expect(resolveTrustAttribution(custom, true)).toEqual({
      mode: 'custom',
      logo: custom.logoDark,
      companyName: 'Acme',
    });
  });

  it('falls back to the light logo on a dark flow without a dark one', () => {
    expect(resolveTrustAttribution({ ...custom, logoDark: '  ' }, true)).toMatchObject({ logo: custom.logo });
  });

  it('stays custom with a malformed logo, never falling back to Myaza', () => {
    expect(resolveTrustAttribution({ mode: 'custom', logo: 42, companyName: ' ' })).toEqual({
      mode: 'custom',
      logo: undefined,
      companyName: undefined,
    });
  });

  it('sizes the logo like the wordmark: 24 tall, width from its ratio, at most 144', () => {
    expect(customLogoWidth(200, 100)).toBe(48);
    expect(customLogoWidth(2000, 100)).toBe(144);
    expect(customLogoWidth(undefined, undefined)).toBe(144);
  });
});

describe('the Myaza disclosure', () => {
  it('is needed only with a custom attribution', () => {
    expect(needsMyazaDisclosure(custom)).toBe(true);
    expect(needsMyazaDisclosure({ mode: 'myaza' })).toBe(false);
    expect(needsMyazaDisclosure(undefined)).toBe(false);
  });

  it('names the attribution company, then the workflow, then the branding', () => {
    expect(myazaProviderName(custom, 'Workflow Co', 'Brand Co')).toBe('Acme');
    expect(myazaProviderName({ mode: 'custom', logo: 'x' }, 'Workflow Co', 'Brand Co')).toBe('Workflow Co');
    expect(myazaProviderName({ mode: 'custom', logo: 'x' }, undefined, 'Brand Co')).toBe('Brand Co');
    expect(myazaProviderName({ mode: 'myaza' }, 'Workflow Co', 'Brand Co')).toBe('Workflow Co');
  });
});

describe('the consent notice', () => {
  const notice = (input: Partial<Parameters<typeof consentLegalNotice>[0]>) =>
    legalNoticeText(
      consentLegalNotice({ isBusiness: false, capturesFace: true, recordsVideo: true, attribution: undefined, ...input }),
    );

  it('is unchanged with the Myaza footer', () => {
    expect(notice({})).toBe(
      'By tapping Continue, you agree to the End User Terms and Privacy Policy, and consent to your personal data being processed to verify your identity. This includes facial recognition and recording this session.',
    );
    expect(notice({ isBusiness: true, capturesFace: false, recordsVideo: false })).toBe(
      'By tapping Continue, you agree to the End User Terms and Privacy Policy, and consent to your business and personal data being processed to verify your identity.',
    );
  });

  it('names Myaza Trust for the organisation when the logo is custom', () => {
    expect(notice({ attribution: custom })).toBe(
      'Verification is processed by Myaza Trust for Acme. By tapping Continue, you agree to Myaza Trust’s End User Terms and Privacy Policy, and consent to your personal data being processed to verify your identity. This includes facial recognition and recording this session.',
    );
    expect(notice({ attribution: custom, isBusiness: true, capturesFace: false, recordsVideo: true })).toBe(
      'Verification is processed by Myaza Trust for Acme. By tapping Continue, you agree to Myaza Trust’s End User Terms and Privacy Policy, and consent to your business and personal data being processed to verify your identity. This includes recording this session.',
    );
  });

  it('falls back through the workflow and branding names, then to no name', () => {
    const noName = { mode: 'custom', logo: 'x' };
    expect(notice({ attribution: noName, workflowCompanyName: 'Flow Co', capturesFace: false, recordsVideo: false })).toMatch(
      /^Verification is processed by Myaza Trust for Flow Co\. By tapping/,
    );
    expect(notice({ attribution: noName, brandingCompanyName: 'Brand Co' })).toMatch(/for Brand Co\./);
    expect(notice({ attribution: noName, capturesFace: false, recordsVideo: false })).toBe(
      'Verification is processed by Myaza Trust. By tapping Continue, you agree to Myaza Trust’s End User Terms and Privacy Policy, and consent to your personal data being processed to verify your identity.',
    );
  });

  it('keeps the two links as their own parts', () => {
    const kinds = consentLegalNotice({ isBusiness: false, capturesFace: false, recordsVideo: false, attribution: custom })
      .map((p) => p.kind);
    expect(kinds.filter((k) => k !== 'text')).toEqual(['terms', 'privacy']);
  });
});

describe('dev asset URLs', () => {
  it('rewrites the custom attribution logos for a local dev server too', () => {
    const out = normalizeBrandingUrls(
      { logo: 'http://localhost:3001/a.png', trustAttribution: { ...custom, logo: 'http://localhost:3001/b.png' } },
      'http://10.0.2.2:3001',
    );
    expect(out?.logo).toBe('http://10.0.2.2:3001/a.png');
    expect(out?.trustAttribution).toMatchObject({ logo: 'http://10.0.2.2:3001/b.png', logoDark: custom.logoDark });
  });
});
