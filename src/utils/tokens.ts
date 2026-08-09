import type { MyazaKYCConfig } from '../types/config';

// Replaces {firstName} / {lastName} / {businessName} tokens with values from
// userData (or ''), mirroring the Flutter SDK's `_fillTokens` and the web
// SDK's token handling ({businessName} is the KYB consent-copy token).
export function fillTokens(template: string, userData: MyazaKYCConfig['userData']): string {
  return template
    .replace(/\{firstName\}/g, userData?.firstName ?? '')
    .replace(/\{lastName\}/g, userData?.lastName ?? '')
    .replace(/\{businessName\}/g, userData?.businessName ?? '')
    .trim();
}
