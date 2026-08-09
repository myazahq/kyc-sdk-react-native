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
  private spokeBefore = false;

  constructor(option: VoiceGuidanceOption | undefined) {
    const resolved = resolveVoiceGuidance(option);
    this.enabled = resolved.enabled;
    this.language = resolved.language;
    if (this.enabled) {
      // Warm the engine NOW, not at the first phrase. Android's TextToSpeech
      // initialises asynchronously, and when the user is well-positioned from
      // the start the first thing this session ever says is the first GESTURE
      // COMMAND — which then races engine init and loses: exactly the phrase
      // a user holding the phone at arm's length cannot afford to miss. Any
      // expo-speech call triggers init; voices is the harmless one. By the
      // time positioning settles the engine is ready and the command plays
      // immediately. iOS initialises synchronously and ignores the warm-up.
      void Speech.getAvailableVoicesAsync().catch(() => undefined);
    }
  }

  /** Speaks `text` unless guidance is off or it equals the last phrase spoken. */
  speak(text: string): void {
    if (!this.enabled || !text || text === this.lastSpoken) return;
    this.lastSpoken = text;
    try {
      // stop() exists to cut off a STALE phrase so guidance stays current.
      // Before anything has been spoken there is nothing to cut off — and on
      // Android calling stop() against a still-initialising engine is exactly
      // the poke that can eat the first queued utterance. Skip it until a
      // phrase has actually been issued.
      if (this.spokeBefore) Speech.stop();
      this.spokeBefore = true;
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
