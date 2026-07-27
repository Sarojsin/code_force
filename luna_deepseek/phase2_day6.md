# Phase 2 Day 6 — SoundEngine + Asset Pipeline Update

## Goal
Build `SoundEngine.ts` (expo-av wrapper) that loads and plays meow/purr/yawn/celebrate sounds from the asset directory. Update the asset download pipeline to include a `sounds/` folder in `luna_assets_v1.zip`.

---

## 6.1 Install expo-av

```bash
cd mobile
npx expo install expo-av
```

---

## 6.2 Update `src/services/companion/assetPaths.ts`

Add the sounds directory constant:

```typescript
export const COMPANION_DIR = documentDirectory + 'companion/';
export const SPRITESHEET_PATH = COMPANION_DIR + 'spritesheet.png';
export const SPRITESHEET_JSON_PATH = COMPANION_DIR + 'spritesheet.json';
export const DIALOGUES_PATH = COMPANION_DIR + 'dialogues.json';
export const SOUNDS_DIR = COMPANION_DIR + 'sounds/';
```

---

## 6.3 Create `src/services/companion/SoundEngine.ts`

```typescript
import { Audio } from 'expo-av';
import { SOUNDS_DIR } from './assetPaths';
import { useCompanionStore } from '../../stores/companionStore';

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
```

---

## 6.4 Update `assetDownloader.ts` — Include Sounds in Install

**File:** `src/services/assetDownloader.ts`

The directory structure inside `luna_assets_v1.zip` becomes:

```
companion/
  ├── spritesheet.png
  ├── spritesheet.json
  ├── dialogues.json
  └── sounds/
      ├── meow.mp3
      ├── purr.mp3
      ├── yawn.mp3
      └── celebrate.mp3
```

Update the `extractLunaAssets` function to verify the `sounds/` directory exists after extraction:

```typescript
// Inside extractLunaAssets, after extracting the zip:
const soundsDir = COMPANION_DIR + 'sounds/';
const soundsInfo = await FileSystem.getInfoAsync(soundsDir);
if (!soundsInfo.exists) {
  // Create sounds directory for backward compatibility with v1.0.0 zips
  await FileSystem.makeDirectoryAsync(soundsDir, { intermediates: true });
}
```

Update the `installLuna` function to pre-load the sound engine (with existence check):

```typescript
// After activating assets:
import { soundEngine } from './companion/SoundEngine';
import { SOUNDS_DIR } from './companion/assetPaths';

const soundsInfo = await FileSystem.getInfoAsync(SOUNDS_DIR);
if (soundsInfo.exists) {
  await soundEngine.loadAssets();
} else {
  logger.warn?.('Sounds directory missing — skipping sound load');
}
```

Update `uninstallLuna` to unload sounds:

```typescript
// Before deleting COMPANION_DIR:
await soundEngine.unloadAssets();
```

---

## 6.5 Update `LunaInstallScreen.tsx` — Show Sound Capability

**File:** `src/screens/companion/LunaInstallScreen.tsx`

Add a sound effects row to the feature list:

```typescript
const FEATURES = [
  // ... existing features ...
  { icon: '🔊', text: 'Sound effects (meows, purrs, yawns)' },
];
```

---

## 6.6 Create Actual Sound Files (Placeholder)

For development, create placeholder sound files. In production, these ship inside `luna_assets_v1.zip`.

```bash
mkdir -p mobile/assets/companion/sounds
# Place actual .mp3 files from your sound designer here
# For dev, create 1-second silent mp3s or skip
```

If no sound files exist, `SoundEngine.loadAssets()` silently skips them — the app works without sounds.

---

## 6.7 Validation

- [ ] `expo-av` installed
- [ ] `assetPaths.ts` exports `SOUNDS_DIR`
- [ ] `SoundEngine.loadAssets()` loads all 4 sounds from `SOUNDS_DIR`
- [ ] `SoundEngine.playForAnimation('happy')` plays meow
- [ ] `SoundEngine.playForAnimation('celebrate')` plays celebrate
- [ ] `muteSounds` toggle prevents playback
- [ ] `assetDownloader.ts` creates `sounds/` dir after extraction
- [ ] `installLuna()` calls `soundEngine.loadAssets()`
- [ ] `uninstallLuna()` calls `soundEngine.unloadAssets()`
- [ ] App works gracefully without sound files (silent fail)
- [ ] `tsc --noEmit` passes with 0 new errors
