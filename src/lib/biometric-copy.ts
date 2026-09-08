import { configScope } from './scope';
import { fillTokens } from '../utils/tokens';
import type { BiometricCopy, BiometricCopyText } from '../config/biometricOptions';
import type { MyazaKYCConfig } from '../types/config';

// ─── The org's copy on the biometric screens, ready to render ───────────────
//
// Pure. Resolves `config.biometric.copy` for the screens: tokens filled from
// `userData` exactly as the consent and success copy are, a field that empties
// out once its tokens resolve treated as absent (the default shows rather than
// a blank title), and everything null off the biometric scopes, where the
// block never applies. The screens hand the result to describeWaiting /
// describeOutcome (lib/result-copy.ts) as overrides. Mirrors the web SDK's
// lib/biometric-copy.ts and Flutter's config/biometric_copy.dart; keep the
// three in lockstep.

export interface ResolvedBiometricCopy {
  waiting: BiometricCopyText | null;
  verified: BiometricCopyText | null;
  declined: BiometricCopyText | null;
}

export const NO_BIOMETRIC_COPY: ResolvedBiometricCopy = { waiting: null, verified: null, declined: null };

type CopyConfigLike = {
  scope?: string;
  biometric?: { copy?: BiometricCopy } | null;
  userData?: MyazaKYCConfig['userData'];
};

export function biometricCopyFor(config: CopyConfigLike): ResolvedBiometricCopy {
  const scope = configScope(config);
  if (scope !== 'biometric-authentication' && scope !== 'biometric-enrollment') return NO_BIOMETRIC_COPY;
  const copy = config.biometric?.copy;
  if (!copy) return NO_BIOMETRIC_COPY;
  const fill = (text: BiometricCopyText | undefined): BiometricCopyText | null => {
    if (!text) return null;
    const title = text.title ? fillTokens(text.title, config.userData) : '';
    const description = text.description ? fillTokens(text.description, config.userData) : '';
    const out: BiometricCopyText = {};
    if (title) out.title = title;
    if (description) out.description = description;
    return Object.keys(out).length > 0 ? out : null;
  };
  return {
    waiting: fill(copy.waiting),
    // Enrolment shows no verdict, so a stray key there has no screen to land on.
    verified: scope === 'biometric-authentication' ? fill(copy.verified) : null,
    declined: scope === 'biometric-authentication' ? fill(copy.declined) : null,
  };
}
