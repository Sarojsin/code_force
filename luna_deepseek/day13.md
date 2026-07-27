# Day 13 — Bug Fixes + Performance Optimization

## Goal
Fix bugs discovered during Day 12 testing and optimize performance for low-end devices. Implement memory profiling and animation throttling.

---

## 13.1 Critical Bug Fixes

### LUN-001: XP Bar Doesn't Update After Level Up

**Root Cause:** The `animatedStyle` in `LunaOverlay` reads `xp` and `xpToNext` as static values at render time. After level up, `xpToNext` changes but the progress bar doesn't recalculate.

**Fix:** Use a derived value that updates reactively:

```typescript
// In LunaOverlay.tsx
const xpProgress = useMemo(() => {
  if (xpToNext <= 0) return 1;
  return Math.min(xp / xpToNext, 1);
}, [xp, xpToNext]);
```

### LUN-002: Speech Bubble Overlaps Tab Bar on Small Screens

**Root Cause:** `BUBBLE_MAX_WIDTH` is hardcoded at 55% of screen width. On very small screens (320px wide), this still allows the bubble to extend into the tab bar area.

**Fix:**

```typescript
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUBBLE_MAX_WIDTH = Math.min(SCREEN_WIDTH * 0.55, 200);
const BUBBLE_MAX_HEIGHT = SCREEN_HEIGHT * 0.3;
```

Also add a bottom offset check:

```typescript
const bubbleStyle = {
  maxWidth: BUBBLE_MAX_WIDTH,
  maxHeight: BUBBLE_MAX_HEIGHT,
  marginBottom: SCREEN_HEIGHT < 700 ? 2 : 4, // Less margin on small screens
};
```

### LUN-003: Pet XP Cooldown Resets on App Restart

**Root Cause:** `lastPetTime` is a `useRef` — lost on unmount/restart.

**Fix:** Persist the last pet timestamp in the companion store's memory:

```typescript
// In handleTap in LunaOverlay.tsx
const checkLastPetTime = async () => {
  const store = useCompanionStore.getState();
  const lastPet = (store.memory.lastPetTime as number) ?? 0;
  const now = Date.now();
  if (now - lastPet > PET_COOLDOWN_MS) {
    await store.updateMemory('lastPetTime', now);
    return true; // Can award XP
  }
  return false; // On cooldown
};
```

### LUN-004: EventEngine Double Subscription on Remount

**Root Cause:** The `lunaInitialized` ref in HomeDashboard doesn't reset when the component unmounts due to a navigation lifecycle issue.

**Fix:** Ensure cleanup runs and ref resets properly:

```typescript
useEffect(() => {
  if (lunaEnabled && !lunaInitialized.current) {
    lunaInitialized.current = true;
    eventCleanupRef.current = initEventEngine(showBubble);
  }

  return () => {
    if (eventCleanupRef.current) {
      eventCleanupRef.current();
      eventCleanupRef.current = null;
      lunaInitialized.current = false; // ✅ Reset on cleanup
    }
  };
}, [lunaEnabled, showBubble]);
```

---

## 13.2 Performance Optimizations

### 13.2.1 Animation Throttling

Ensure animations are throttled based on device capability:

```typescript
// In AnimationEngine.ts
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info'; // optional

const IS_LOW_END = Platform.OS === 'android' && Platform.Version < 28; // Android 9-

// Reduce animation complexity on low-end devices
export const ANIMATION_FRAMES: Record<AnimationState, FrameConfig> = {
  // ... existing config, but on low-end:
  // Reduce frame counts, increase speed
};

// In useAnimationEngine:
const play = useCallback((state: AnimationState, options?: { force?: boolean }) => {
  if (reduceAnimations && !options?.force) return;
  // ... rest of animation logic
}, [reduceAnimations]);
```

### 13.2.2 Memoize Expensive Computations

Wrap `LunaSprite` and speech bubble components with `React.memo`:

```typescript
export const SpeechBubble = React.memo(function SpeechBubble({ text }: { text: string }) {
  return (
    <View style={styles.bubbleContainer}>
      <View style={styles.bubble}>
        <Text variant="caption" align="center" style={styles.bubbleText} numberOfLines={3}>
          {text}
        </Text>
      </View>
      <View style={styles.bubbleArrow} />
    </View>
  );
});
```

### 13.2.3 Reduce Re-renders

Use selectors that subscribe to only the needed slices of Zustand state:

```typescript
// ❌ Bad — subscribes to ALL store changes
const store = useCompanionStore();

// ✅ Good — subscribes only to isHidden changes
const isHidden = useCompanionStore((s) => s.isHidden);
const reduceAnimations = useCompanionStore((s) => s.reduceAnimations);
```

Do this for every `useCompanionStore` call in `LunaOverlay`:

```typescript
const isHidden = useCompanionStore((s) => s.isHidden);
const reduceAnimations = useCompanionStore((s) => s.reduceAnimations);
const xp = useCompanionStore((s) => s.xp);
const level = useCompanionStore((s) => s.level);
const xpToNext = useCompanionStore((s) => s.xpToNext);
const levelTitle = useCompanionStore((s) => s.levelTitle);
```

### 13.2.4 Image/Sprite Caching

If using actual PNG sprite assets, wrap the image in a cache:

```typescript
// TODO: When spritesheet PNG is ready, use expo-image or fast-image
// import { Image } from 'expo-image';
// <Image source={require('../../assets/companion/luna_idle.png')} cachePolicy="memory-disk" />
```

For the downloaded spritesheet PNG, use `expo-image` with disk caching:

```typescript
// When using the downloaded spritesheet:
import { Image } from 'expo-image';
// <Image source={{ uri: SPRITESHEET_PNG }} cachePolicy="disk" />
```

This prevents re-decoding the PNG on every render.

### 13.2.5 Download Edge Cases

These bugs are specific to the Game DLC download model:

#### LUN-005: Download Resumes Multiple Times on Network Flap

**Root Cause:** `createDownloadResumable` auto-resumes on network recovery. If the network flaps rapidly, multiple resume calls may create duplicate files.

**Fix:** Add a download-in-progress lock:

```typescript
let downloadInProgress = false;

export async function installLuna(userId: string): Promise<boolean> {
  if (downloadInProgress) {
    logger.warn('Download already in progress, skipping');
    return false;
  }
  downloadInProgress = true;
  try {
    // ... download logic ...
  } finally {
    downloadInProgress = false;
  }
}
```

#### LUN-006: No Feedback When Download Fails Midway

**Root Cause:** The catch block only logs the error but doesn't update the download store state.

**Fix:** Ensure every error path updates the store and cleans up:

```typescript
catch (error: any) {
  useDownloadStore.getState().setError(error?.message ?? 'Download failed');
  await cleanup(DOWNLOAD_PATH);
  return false;
}
```

#### LUN-007: Storage Full Not Detected Before Download

**Root Cause:** No free space check before starting the download.

**Fix:** Add a free space check:

```typescript
import * as FileSystem from 'expo-file-system';

async function hasEnoughSpace(requiredBytes: number): Promise<boolean> {
  const info = await FileSystem.getFreeDiskStorageAsync();
  return info > requiredBytes * 1.5; // 50% buffer
}

// In installLuna, before downloading:
const requiredBytes = metadata.size_mb * 1024 * 1024;
const hasSpace = await hasEnoughSpace(requiredBytes);
if (!hasSpace) {
  store.setError('Not enough storage. Please free up at least ' +
    Math.ceil(requiredBytes / (1024 * 1024)) + ' MB.');
  return false;
}
```

#### LUN-008: Checksum Computed on Corrupted Partial File

**Root Cause:** If a previous failed download left a partial zip, the checksum is computed on the truncated file.

**Fix:** Delete any existing partial download before starting fresh:

```typescript
// At the start of downloadFile():
const existing = await FileSystem.getInfoAsync(DOWNLOAD_PATH);
if (existing.exists) {
  await FileSystem.deleteAsync(DOWNLOAD_PATH, { idempotent: true });
}
// Then start fresh download
```

#### LUN-009: Dialogue Engine Used Before Assets Loaded

**Root Cause:** The dialogue engine's `loadAssets()` is async, but `get()` could be called before it completes.

**Fix:** Ensure fallback dialogues are always available (they are bundled in the engine constructor):

```typescript
// In DialogueEngine, fallbacks are always present:
private dialogues: Record<string, string[]> = { ...FALLBACK_DIALOGUES };

async loadAssets(): Promise<void> {
  // Merges downloaded dialogues on top of fallbacks
  this.dialogues = { ...FALLBACK_DIALOGUES, ...downloadedDialogues };
}
```

---

### 13.2.6 CPU Idle Mode

Ensure Luna stops ALL animation work when:

- The app is backgrounded (handled via AppState listener)
- The user is on a different tab (check focus state)
- `isHidden` is true (already handled)

Add tab focus detection:

```typescript
// In HomeDashboardScreen.tsx
import { useIsFocused } from '@react-navigation/native';

const isFocused = useIsFocused();

// Only render Luna when the Home tab is focused
{isFocused && lunaEnabled && <LunaOverlay />}
```

**Note:** This unmounts Luna when switching tabs, which resets the inactivity timer. Acceptable trade-off for performance.

---

## 13.3 Memory Profiling

### Check memory usage

```bash
# Android
adb shell dumpsys meminfo com.shecare.app | grep -i luna

# iOS (using Instruments or Xcode Memory Debugger)
```

### Target: Luna's total memory footprint < 15 MB

| Component | Target Memory |
|-----------|--------------|
| Sprite assets (PNG spritesheet) | < 2 MB |
| Dialogue JSON | < 50 KB |
| Zustand store state | < 10 KB |
| Reanimated shared values | < 100 KB |
| Event listeners | < 10 KB |
| **Total** | **< 3 MB** (well under 15 MB target) |

---

## 13.4 Bundle Size Impact

Measure the added bundle size:

```bash
cd mobile
npx expo export --platform android --output-dir dist
du -sh dist/
```

Target: Luna adds < 200 KB to the JS bundle (SVG component + JSON + ~300 lines of engine code).

---

## 13.6 Download-Related Checks

- [ ] Download lock prevents concurrent downloads
- [ ] Free space check runs before download starts
- [ ] Partial download files cleaned up on failure
- [ ] Checksum computed on complete file (partial files deleted first)
- [ ] Error messages are user-friendly (not raw exceptions)
- [ ] Download progress updates smoothly (not janky)
- [ ] Cellular data warning respects user choice
- [ ] Uninstall confirmation prevents accidental removal
- [ ] Dialogue engine works with fallbacks before asset load
- [ ] Spritesheet PNG cached on disk via expo-image

---

## 13.7 Final Performance Checklist

- [ ] All animations run on UI thread (Reanimated worklet)
- [ ] No `useState` triggers during animation frames
- [ ] Speech bubbles use `React.memo`
- [ ] Zustand selectors are granular (not full store subscribe)
- [ ] Event engine listeners removed on unmount
- [ ] App background kills all animation work
- [ ] Tab switch unmounts Luna overlay
- [ ] Idle sleep mode reduces animation to zero after 30s
- [ ] Bundle size impact < 200 KB
- [ ] Memory footprint < 15 MB
- [ ] CPU usage < 2% when idle
- [ ] No jank during ScrollView scrolling (tested on 2GB device)
