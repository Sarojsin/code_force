import * as Speech from 'expo-speech';
import { useCompanionStore } from '../../stores/companionStore';

/**
 * Opt-in TTS ("Luna speaks", luna2phase3). Off by default; gated by the same
 * mute setting as sound effects. Voice selection is deterministic: resolved
 * once on first enable, persisted in `companion_metadata.memory.speech`, and
 * reused across sessions (re-resolved only when the persisted id vanishes).
 */

export interface SpeakOpts {
  voice?: string;
  rate?: number;
  pitch?: number;
  language?: string;
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
}

export interface VoiceCandidate {
  identifier: string;
  name: string;
  quality: string;
  language: string;
}

const DEFAULT_RATE = 1;
const DEFAULT_PITCH = 1;

/**
 * Pure voice scoring (luna2phase3 §2): prefer `enhanced` quality, then a
 * female-name heuristic; lower index breaks ties for cross-session stability.
 */
export function resolveVoice(voices: VoiceCandidate[]): VoiceCandidate | undefined {
  if (!voices || voices.length === 0) return undefined;
  let best: VoiceCandidate | undefined;
  let bestScore = -Infinity;
  voices.forEach((voice, index) => {
    const quality = String(voice.quality ?? '').toLowerCase();
    let score = 0;
    if (quality === 'enhanced') score += 1000;
    else if (quality === 'default') score += 500;
    const name = String(voice.name ?? '').toLowerCase();
    if (name.includes('female')) score += 100;
    else if (name.includes('male')) score += 0;
    score -= index;
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  });
  return best ?? voices[0];
}

class VoiceService {
  private speakingListeners = new Set<(speaking: boolean) => void>();

  isEnabled(): boolean {
    const state = useCompanionStore.getState();
    return state.speakEnabled && !state.muteSounds;
  }

  getVoiceId(): string | null {
    return useCompanionStore.getState().speechVoiceId;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    const state = useCompanionStore.getState();
    await state.setSpeechPref({ enabled });
    if (enabled) {
      const voiceId = await this.resolveVoiceId();
      if (voiceId && state.speechVoiceId !== voiceId) {
        await state.setSpeechPref({ voiceId });
      }
    } else {
      this.stop();
    }
  }

  onSpeaking(cb: (speaking: boolean) => void): () => void {
    this.speakingListeners.add(cb);
    return () => this.speakingListeners.delete(cb);
  }

  private emitSpeaking(speaking: boolean): void {
    this.speakingListeners.forEach((cb) => cb(speaking));
  }

  async speak(text: string, opts: SpeakOpts = {}): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    this.stop();
    const state = useCompanionStore.getState();
    const rate = opts.rate ?? state.speechRate ?? DEFAULT_RATE;
    const pitch = opts.pitch ?? state.speechPitch ?? DEFAULT_PITCH;
    const voice = opts.voice ?? (await this.resolveVoiceId());

    const onStart = () => {
      this.emitSpeaking(true);
      opts.onStart?.();
    };
    const onDone = () => {
      this.emitSpeaking(false);
      opts.onDone?.();
    };
    const onStopped = () => {
      this.emitSpeaking(false);
      opts.onStopped?.();
    };

    try {
      Speech.speak(text, {
        language: opts.language,
        rate,
        pitch,
        ...(voice ? { voice } : {}),
        onStart,
        onDone,
        onStopped,
      });
    } catch (error) {
      this.emitSpeaking(false);
      opts.onDone?.();
    }
  }

  stop(): void {
    this.emitSpeaking(false);
    try {
      Speech.stop();
    } catch {
      // ignore
    }
  }

  async resolveVoiceId(): Promise<string | undefined> {
    const persisted = useCompanionStore.getState().speechVoiceId;
    let voices: VoiceCandidate[] = [];
    try {
      voices = (await Speech.getAvailableVoicesAsync()) as unknown as VoiceCandidate[];
    } catch {
      return persisted ?? undefined;
    }
    if (persisted && voices.some((v) => v.identifier === persisted)) {
      return persisted;
    }
    const resolved = resolveVoice(voices);
    const id = resolved?.identifier;
    if (id) {
      await useCompanionStore.getState().setSpeechPref({ voiceId: id });
    }
    return id;
  }
}

export const voiceService = new VoiceService();
