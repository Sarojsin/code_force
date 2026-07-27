import { Audio } from 'expo-av';
import { SOUNDS_DIR } from './assetPaths';
import { useCompanionStore } from '../../stores/companionStore';
import { eventBus } from '../eventBus';

export type SoundName = 'meow' | 'purr' | 'yawn' | 'celebrate';

const SOUND_FILES: Record<SoundName, string> = {
  meow: 'meow.mp3',
  purr: 'purr.mp3',
  yawn: 'yawn.mp3',
  celebrate: 'celebrate.mp3',
};

const ANIMATION_SOUND_MAP: Record<string, SoundName> = {
  happy: 'meow',
  pet: 'purr',
  sleep: 'yawn',
  celebrate: 'celebrate',
};

class SoundEngine {
  private sounds = new Map<string, Audio.Sound>();
  private loaded = false;
  private unsub: (() => void) | null = null;

  async loadAssets(): Promise<void> {
    if (this.loaded) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
    } catch {
      // Silent fail
    }

    for (const [key, filename] of Object.entries(SOUND_FILES)) {
      try {
        const sound = new Audio.Sound();
        await sound.loadAsync({ uri: SOUNDS_DIR + filename });
        this.sounds.set(key, sound);
      } catch {
        // Silent fail — sounds are optional
      }
    }
    this.loaded = true;
  }

  setupEventSubscription(): void {
    if (this.unsub) return;
    this.unsub = eventBus.on('luna_animation_changed', ({ state }) => {
      this.playForAnimation(state);
    });
  }

  teardownEventSubscription(): void {
    this.unsub?.();
    this.unsub = null;
  }

  async playForAnimation(animationState: string): Promise<void> {
    const mute = useCompanionStore.getState().muteSounds;
    if (mute) return;

    const soundName = ANIMATION_SOUND_MAP[animationState];
    if (!soundName) return;

    const sound = this.sounds.get(soundName);
    if (!sound) return;

    try {
      await sound.replayAsync();
    } catch {
      // Silent fail
    }
  }

  async playSound(name: SoundName): Promise<void> {
    const mute = useCompanionStore.getState().muteSounds;
    if (mute) return;

    const sound = this.sounds.get(name);
    if (!sound) return;

    try {
      await sound.replayAsync();
    } catch {
      // Silent fail
    }
  }

  async unloadAssets(): Promise<void> {
    this.teardownEventSubscription();
    for (const sound of this.sounds.values()) {
      try {
        await sound.unloadAsync();
      } catch {
        // Silent fail
      }
    }
    this.sounds.clear();
    this.loaded = false;
  }
}

export const soundEngine = new SoundEngine();
