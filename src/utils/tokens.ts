import type { MyazaKYCConfig } from '../types/config';

// Replaces {firstName} / {lastName} tokens with values from userData (or ''),
// mirroring the Flutter SDK's `_fillTokens` and the web SDK's token handling.
export function fillTokens(template: string, userData: MyazaKYCConfig['userData']): string {
  return template
    .replace(/\{firstName\}/g, userData?.firstName ?? '')
    .replace(/\{lastName\}/g, userData?.lastName ?? '')
    .trim();
}
