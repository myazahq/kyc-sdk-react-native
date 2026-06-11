// ---------------------------------------------------------------------------
// Spoken liveness guidance — TTS OUTPUT ONLY (no microphone). Mirrors the web
// SDK's liveness/speech.ts and the Flutter SDK's _TtsService. Backed by
// expo-speech. Voice guidance exists for accessibility; it never records audio,
// so there is no microphone permission and no microphone error code.
// ---------------------------------------------------------------------------

import * as Speech from 'expo-speech';

import type { VoiceGuidanceOption } from '../types/config';

export interface ResolvedVoiceGuidance {
  enabled: boolean;
  language: string;
}

/** Normalises the `voiceGuidance` config (bool | object | undefined) → object. */
export function resolveVoiceGuidance(option: VoiceGuidanceOption | undefined): ResolvedVoiceGuidance {
  if (option === false) return { enabled: false, language: 'en-US' };
  if (option === true || option == null) return { enabled: true, language: 'en-US' };
  return { enabled: option.enabled !== false, language: option.language ?? 'en-US' };
}

/**
 * A tiny speaker that de-dupes consecutive identical phrases (so a guidance
 * string repeated every frame is only spoken once) and no-ops when disabled.
 * One instance per liveness session.
 */
export class LivenessSpeaker {
  private readonly enabled: boolean;
  private readonly language: string;
  private lastSpoken: string | null = null;

  constructor(option: VoiceGuidanceOption | undefined) {
    const resolved = resolveVoiceGuidance(option);
    this.enabled = resolved.enabled;
    this.language = resolved.language;
  }

  /** Speaks `text` unless guidance is off or it equals the last phrase spoken. */
  speak(text: string): void {
    if (!this.enabled || !text || text === this.lastSpoken) return;
    this.lastSpoken = text;
    try {
      Speech.stop();
      Speech.speak(text, { language: this.language });
    } catch {
      /* TTS is best-effort — a failure must never block the flow */
    }
  }

  /** Clears the de-dupe memory so the next `speak` always plays (e.g. on retry). */
  reset(): void {
    this.lastSpoken = null;
  }

  /** Stops any in-flight speech. Call when the liveness screen unmounts. */
  stop(): void {
    this.lastSpoken = null;
    try {
      Speech.stop();
    } catch {
      /* ignore */
    }
  }
}
