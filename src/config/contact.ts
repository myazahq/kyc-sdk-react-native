// ---------------------------------------------------------------------------
// Contact verification (email / phone OTP) — the pure half.
//
// Possession checks that sit right after consent, before any capture or
// registry spend. A passing check yields a single-use proof token that rides
// the /verify submission; the server is what actually enforces it, so
// everything here is about not wasting the user's time on a round trip that
// will obviously fail.
// ---------------------------------------------------------------------------

import type { EmailVerificationConfig, PhoneVerificationConfig } from '../types/workflow';

/**
 * What a contact step is currently doing, published to the store so the SHEET
 * HEADER can describe it — the header is rendered by the shell, which cannot
 * see the step's local state.
 *
 * `channel` is what makes it safe to leave behind: a header only trusts state
 * raised by the step it is titling, so a leftover email entry can never caption
 * the phone step.
 */
export interface ContactChallenge {
  channel: 'email' | 'phone';
  /** Delivery channel the code will go out on, or went out on (phone only). */
  via?: 'sms' | 'whatsapp';
  /**
   * Set once a code is actually out. Its presence is what turns the header from
   * a promise ("we'll send a code") into an instruction ("enter the code we
   * sent to …").
   */
  destination?: string;
}

/** Server-clamped bounds; mirrored so the UI renders the right number of slots. */
export const MIN_CODE_LENGTH = 4;
export const MAX_CODE_LENGTH = 8;
export const DEFAULT_CODE_LENGTH = 6;

export function hasEmailVerificationStep(cfg: EmailVerificationConfig | undefined | null): boolean {
  return cfg?.enabled === true;
}

export function hasPhoneVerificationStep(cfg: PhoneVerificationConfig | undefined | null): boolean {
  return cfg?.enabled === true;
}

/**
 * Whether the user may skip this check.
 *
 * Required defaults TRUE when the step is enabled: a workflow that adds an OTP
 * step and says nothing about `required` meant to require it. Only an explicit
 * `required: false` offers the skip.
 */
export function contactIsRequired(
  cfg: EmailVerificationConfig | PhoneVerificationConfig | undefined,
): boolean {
  return cfg?.required !== false;
}

/** Code length, clamped to what the server will accept. */
export function contactCodeLength(
  cfg: EmailVerificationConfig | PhoneVerificationConfig | undefined,
): number {
  const raw = cfg?.codeLength ?? DEFAULT_CODE_LENGTH;
  return Math.min(MAX_CODE_LENGTH, Math.max(MIN_CODE_LENGTH, Math.round(raw)));
}

/**
 * Header title/description for a contact step, read by stepHeaderMeta.
 *
 * Wording matches the web SDK exactly, including the way the description turns
 * from a promise ("we'll send a code…") into an instruction ("enter the code we
 * sent to…") once a code is out. The shell renders the header, so the step
 * publishes its outstanding challenge to the store for this to read.
 *
 * A challenge raised for the OTHER channel is ignored: both steps are the same
 * component, and a leftover email challenge must never caption the phone step.
 */
export function contactMeta(
  channel: 'email' | 'phone',
  ctx?: { codeLength?: number; challenge?: ContactChallenge | null },
): { title: string; description: string } {
  const isEmail = channel === 'email';
  const title = isEmail ? 'Verify your email' : 'Verify your phone number';
  const live = ctx?.challenge?.channel === channel ? ctx.challenge : null;
  const by = !isEmail && live?.via ? ` by ${CHANNEL_LABELS[live.via]}` : '';

  if (live?.destination) {
    const length = ctx?.codeLength ?? DEFAULT_CODE_LENGTH;
    return {
      title,
      description: `Enter the ${length}-digit code we sent to ${live.destination}${by}.`,
    };
  }

  return {
    title,
    description: isEmail
      ? "We'll send a one-time code to confirm this email belongs to you."
      : `We'll send a one-time code${by} to confirm this number belongs to you.`,
  };
}

export type PhoneOtpChannel = 'sms' | 'whatsapp';

const KNOWN_CHANNELS: PhoneOtpChannel[] = ['sms', 'whatsapp'];

export const CHANNEL_LABELS: Record<PhoneOtpChannel, string> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

/**
 * The delivery channels a phone step offers, normalised.
 *
 * Never empty: an unset, empty or entirely-unrecognised list falls back to SMS,
 * which is what the server defaults to when `via` is omitted. Unknown values are
 * dropped so a channel added server-side cannot render as an unlabelled option
 * in an older build. Order is the workflow's, so its first entry is the default.
 */
export function offeredPhoneChannels(channels?: string[] | null): PhoneOtpChannel[] {
  const known = (channels ?? []).filter((c): c is PhoneOtpChannel =>
    KNOWN_CHANNELS.includes(c as PhoneOtpChannel),
  );
  const deduped = Array.from(new Set(known));
  return deduped.length > 0 ? deduped : ['sms'];
}

/**
 * Email shape check.
 *
 * Deliberately permissive — the real proof of an address is that a code sent to
 * it arrives, and a strict pattern rejects valid addresses (new TLDs, plus
 * addressing, unicode local parts) far more often than it catches a typo.
 */
export function isValidContactEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  if (/\s/.test(trimmed)) return false;
  const at = trimmed.indexOf('@');
  if (at <= 0 || at !== trimmed.lastIndexOf('@')) return false;
  const domain = trimmed.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

/**
 * Phone shape check against E.164: a leading `+`, then 8–15 digits.
 *
 * Only the format is checked here. Whether the number is reachable is the OTP's
 * job, and whether the country is plausible is the server's.
 */
export function isValidContactPhone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value.replace(/[\s()-]/g, ''));
}

/** Strips formatting so the submitted number is E.164. */
export function normalizeContactPhone(value: string): string {
  return value.replace(/[\s()-]/g, '');
}
