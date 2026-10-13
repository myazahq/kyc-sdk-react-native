// The names this SDK first shipped under. They still work and point at
// the current ones, so an existing integration upgrades with no code change.
// New code should use the current names.

import { Verification, useVerification } from './Verification';
import type { UseVerificationReturn, VerificationProps } from './Verification';
import type { VerificationConfig } from './types/config';

/** @deprecated Use `Verification`. */
export const MyazaKYC = Verification;
/** @deprecated Use `useVerification`. */
export const useMyazaKYC = useVerification;

/** @deprecated Use `VerificationConfig`. */
export type MyazaKYCConfig = VerificationConfig;
/** @deprecated Use `VerificationProps`. */
export type MyazaKYCProps = VerificationProps;
/** @deprecated Use `UseVerificationReturn`. */
export type UseMyazaKYCReturn = UseVerificationReturn;
