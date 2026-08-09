// ---------------------------------------------------------------------------
// Pure derivations over the flow state.
//
// Split from kycStore.ts (200-line rule). Everything here is a function of
// state alone — no `set`, no side effects — which is what makes the flow's
// shape (which steps run, in what order, against which country) testable and
// keeps a single answer to each of those questions.
// ---------------------------------------------------------------------------

import { requiresDocumentCapture, supportsNfcChip } from '../config/idTypes';
import {
  getStepProgress,
  nextStepInOrder,
  previousStepInOrder,
  type StepOrderOptions,
} from '../config/stepOrder';
import { hasProofOfAddressStep } from '../config/proofOfAddress';
import { businessProductsForCountry, isBusinessFlow } from '../config/business';
import {
  hasApplicantVerification,
  hasBusinessDocumentsStep,
  hasKeyPeopleCollection,
} from '../config/businessSteps';
import { hasActiveQuestionnaire } from '../config/questionnaire';
import { applicantSelfCountry, keyPeoplePayload } from '../config/keyPeople';
import { featuresFor } from './serverConfig';
import type { VerifyRequest } from '../services/api';
import type { KYCStep, SupportedCountry } from '../types/config';
import type { KycState } from './state';

export function livenessEnabled(state: KycState): boolean {
  // Consumer baseline: liveness is on unless explicitly disabled.
  if (state.config.enableLiveness === false) return false;
  const idType = state.selectedIdType;
  if (!idType) return true;
  // Server flag wins when present; otherwise keep the consumer baseline (on).
  const features = featuresFor(state.serverConfig, effectiveCountry(state), idType);
  return features ? features.livenessCheck : true;
}

/**
 * Derive the step-order inputs from live state.
 *
 * `hasDocCapture` defaults TRUE before an ID is picked so the order stays a
 * plausible shape while the user is still on consent — nothing navigates by it
 * until an ID is selected, and the same default is what the web SDK's progress
 * bar uses.
 */
export function stepOrderOptions(state: KycState): StepOrderOptions {
  const { config } = state;
  const idType = state.selectedIdType;
  return {
    isBusiness: isBusinessFlow(config),
    business: config.business,
    hasDocCapture: idType ? requiresDocumentCapture(idType) : true,
    hasNfc: nfcEnabled(state),
    hasLiveness: livenessEnabled(state),
    // Individual flows offer the workflow's `countries`; the KYB applicant's
    // own capture leg has no such list (business configs carry no individual
    // fields), so it offers the org's GRANTED countries — the applicant may
    // hold an ID issued anywhere the org can verify. Mirrors the web SDK.
    // EXCEPT when the applicant picked THEMSELVES from the key people and
    // that entry carries a country: "where was your ID issued?" was already
    // answered there, so the leg skips the country-select step.
    hasCountrySelect:
      countrySelectOptions(state).length > 1 &&
      applicantSelfCountry(state.businessApplication) === null,
    hasEmailVerification: config.emailVerification?.enabled === true,
    hasPhoneVerification: config.phoneVerification?.enabled === true,
    hasPoa: hasProofOfAddressStep(config.proofOfAddress),
    hasQuestionnaire: hasActiveQuestionnaire(config.questionnaire),
  };
}

/**
 * The countries the country-select step offers: the workflow's `countries`
 * when configured, else the org's granted countries from the server config
 * (the KYB applicant leg's case — business configs carry no individual
 * country list). Empty while the server config is still loading.
 */
export function countrySelectOptions(state: Pick<KycState, 'config' | 'serverConfig'>): string[] {
  const configured = (state.config.countries ?? []).map((entry) => entry.country.toUpperCase());
  if (configured.length > 0) return configured;
  if (state.serverConfig.status !== 'ready') return [];
  const seen = new Set<string>();
  for (const row of state.serverConfig.idTypes) seen.add(row.country.toUpperCase());
  return [...seen];
}

/**
 * The country this session is actually verifying against.
 *
 * A multi-region flow lets the user pick one, and that choice — not the
 * workflow's primary country — decides the ID types, the validators, the
 * endpoints and the chip capability. Every read must go through here; a stray
 * `config.country` in a later step is a flow that offers Ghanaian IDs and then
 * validates them as Nigerian.
 *
 * KYB configs carry no individual `country`, so the applicant's capture leg
 * falls back to the registry country until (or unless) a country is picked.
 */
export function effectiveCountry(state: KycState): SupportedCountry {
  return (state.selectedCountry ??
    state.config.country ??
    state.business.country ??
    state.config.business?.country) as SupportedCountry;
}

/**
 * The registry details a KYB submission carries.
 *
 * The country is the one PICKED on business-details (multi-registry workflows
 * offer several) rather than the workflow's primary, and the product is
 * narrowed to that country — offering Nigeria's TIN after the visitor picks
 * Ghana produces a submission the server refuses.
 */
export function businessSubmission(state: KycState): {
  country: string;
  product: string;
  payload: NonNullable<VerifyRequest['business']>;
} {
  const config = state.config.business!;
  const b = state.business;
  const app = state.businessApplication;
  const people = keyPeoplePayload(app.keyPeople, app.applicantKeyPersonIndex);
  const country = b.country ?? config.country;
  const product = b.product ?? businessProductsForCountry(config, country)[0]!;
  const text = (value: string): string | undefined => {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  };
  return {
    country,
    product,
    payload: {
      registrationNumber: b.registrationNumber.trim(),
      product,
      ...(text(b.registrationName) ? { registrationName: text(b.registrationName) } : {}),
      ...(text(b.contactEmail) ? { contactEmail: text(b.contactEmail) } : {}),
      ...(text(b.address) ? { address: text(b.address) } : {}),
      ...(text(b.email) ? { email: text(b.email) } : {}),
      ...(text(b.phone) ? { phone: text(b.phone) } : {}),
      ...(text(b.website) ? { website: text(b.website) } : {}),
      // Extras ride along ONLY when the workflow configures them — the server
      // ignores an unconfigured block, but sending one is a claim we did not
      // collect properly.
      ...(hasBusinessDocumentsStep(config) && app.documents.length > 0
        ? { documents: app.documents.map((d) => ({ type: d.type, mediaId: d.mediaId })) }
        : {}),
      ...(hasKeyPeopleCollection(config) && people.length > 0 ? { keyPeople: people } : {}),
      ...(hasApplicantVerification(config) && app.applicantRole
        ? {
            applicant: {
              role: app.applicantRole,
              ...(app.applicantName.trim() ? { name: app.applicantName.trim() } : {}),
            },
          }
        : {}),
    },
  };
}

/**
 * Whether the chip-read step runs for the selected ID.
 *
 * Off unless the workflow turns it on — a chip read needs a physical document
 * with a chip AND an NFC radio, so it is never a silent default. `idTypes` is
 * a list of "CC/idType" keys; absent/empty means every chip-capable ID.
 */
export function nfcEnabled(state: KycState): boolean {
  return nfcDecision(state).enabled;
}

/**
 * Whether the chip step runs — and, when it does not, WHICH condition removed it.
 *
 * Four independent gates can each delete this step, and a missing step looks
 * identical from the outside however it went missing: the flow simply walks past
 * the chip read with nothing logged. That has already cost real debugging time
 * once, when a transient native-module miss was indistinguishable from a phone
 * with no NFC radio.
 *
 * The reason is therefore returned rather than collapsed into a boolean, and
 * logged in dev. It costs nothing in production and turns "the NFC screen did
 * not show up" into a one-line answer.
 */
export function nfcDecision(state: KycState): { enabled: boolean; reason?: string } {
  const nfc = state.config.nfc;
  if (nfc?.enabled !== true) return { enabled: false, reason: 'workflow_nfc_disabled' };
  const idType = state.selectedIdType;
  if (!idType) return { enabled: false, reason: 'no_id_type_selected' };
  // The server's per-row answer wins when config has loaded — it covers
  // documents the local catalogue has never heard of.
  const country = effectiveCountry(state);
  const row = state.serverConfig.idTypes.find(
    (t) => t.country === country && t.idType === idType,
  );
  if (!supportsNfcChip(country, idType, row?.supportsNfc)) {
    return { enabled: false, reason: `id_not_chip_capable:${country}/${idType}` };
  }
  const keys = nfc.idTypes;
  if (!keys || keys.length === 0) return { enabled: true };
  return keys.includes(`${country}/${idType}`)
    ? { enabled: true }
    : { enabled: false, reason: `id_not_selected_in_workflow:${country}/${idType}` };
}

/** The step that follows `step`, given the current selection + flags. */
export function nextStepAfter(step: KYCStep, state: KycState): KYCStep {
  return nextStepInOrder(step, stepOrderOptions(state));
}

/** The step before `step` (for the back button). */
export function previousStepBefore(step: KYCStep, state: KycState): KYCStep {
  return previousStepInOrder(step, stepOrderOptions(state));
}

/** Percentage complete, for the sheet's progress indicator. */
export function stepProgress(step: KYCStep, state: KycState): number {
  return getStepProgress(step, stepOrderOptions(state));
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------
