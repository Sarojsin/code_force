# Day 5 — Animation Engine

## Goal
Build the spritesheet-based animation engine that manages Luna's visual states (idle, happy, sad, sleep, jump, wave). Uses `react-native-reanimated` for smooth, performant frame animation.

---

## 5.1 Animation State Definitions

**File:** `src/services/companion/AnimationEngine.ts`

```typescript
/**
 * Spritesheet animation engine for Luna.
 *
 * Manages a set of sprite animations defined as frame regions on a
 * spritesheet PNG. Uses Reanimated shared values for smooth playback.
 *
 * For Phase 1 MVP, if spritesheet assets are not yet ready, the engine
 * falls back to simple opacity/scale animations using Reanimated.
 */

import { useEffect, useRef, useCallback } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

// ── Animation state enum ──
export type AnimationState =
  | 'idle'
  | 'idle_blink'
  | 'happy'
  | 'sad'
  | 'sleep'
  | 'jump'
  | 'wave'
  | 'celebrate'
  | 'pet'
  | 'hidden';

// ── Frame config (for when spritesheets are integrated) ──
export interface FrameConfig {
  frames: number;       // Total frames in the animation
  speed: number;        // ms per frame
  loop?: boolean;       // Whether to loop
  frameWidth?: number;  // px (default: spriteSheetWidth / frames)
  frameHeight?: number; // px
}

export const ANIMATION_FRAMES: Record<AnimationState, FrameConfig> = {
  idle:       { frames: 4, speed: 200, loop: true },
  idle_blink: { frames: 2, speed: 500, loop: true },
  happy:      { frames: 4, speed: 150, loop: false },
  sad:        { frames: 3, speed: 200, loop: false },
  sleep:      { frames: 2, speed: 500, loop: true },
  jump:       { frames: 6, speed: 100, loop: false },
  wave:       { frames: 4, speed: 100, loop: false },
  celebrate:  { frames: 6, speed: 120, loop: false },
  pet:        { frames: 3, speed: 180, loop: false },
  hidden:     { frames: 1, speed: 0, loop: false },
};

// ── Animation priority (higher = more important) ──
const ANIMATION_PRIORITY: Record<AnimationState, number> = {
  idle: 0,
  idle_blink: 0,
  sleep: 1,
  sad: 2,
  pet: 3,
  wave: 4,
  happy: 5,
  jump: 6,
  celebrate: 7,
  hidden: 10,
};

/**
 * Hook that manages Luna's animation state.
 * Only the highest-priority animation plays at any time.
 */
export function useAnimationEngine() {
  const currentAnim = useSharedValue<AnimationState>('idle');
  const previousAnim = useRef<AnimationState>('idle');
  const priority = useSharedValue(0);

  // ── Scale transform ──
  const scale = useSharedValue(1);

  // ── Opacity ──
  const opacity = useSharedValue(1);

  // ── Vertical bounce (for jump/celebrate) ──
  const translateY = useSharedValue(0);

  // ── Horizontal shake (for sad/wave) ──
  const translateX = useSharedValue(0);

  // ── Rotation (for happiness) ──
  const rotation = useSharedValue(0);

  // ── Set animation with priority check ──
  const play = useCallback((state: AnimationState) => {
    const newPriority = ANIMATION_PRIORITY[state];
    const currentPrio = priority.value;

    // Don't interrupt higher-priority animations
    if (newPriority < currentPrio && currentAnim.value !== 'idle') {
      return;
    }

    previousAnim.current = currentAnim.value;
    currentAnim.value = state;
    priority.value = newPriority;

    // Reset transforms
    cancelAnimation(scale);
    cancelAnimation(translateY);
    cancelAnimation(translateX);
    cancelAnimation(rotation);

    switch (state) {
      case 'idle':
      case 'idle_blink':
        scale.value = withTiming(1, { duration: 300 });
        opacity.value = withTiming(1, { duration: 300 });
        translateY.value = withTiming(0, { duration: 200 });
        translateX.value = withTiming(0, { duration: 200 });
        rotation.value = withTiming(0, { duration: 200 });
        break;

      case 'happy':
        scale.value = withSequence(
          withTiming(1.1, { duration: 150, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: 150 })
        );
        rotation.value = withSequence(
          withTiming(0.05, { duration: 100 }),
          withTiming(-0.05, { duration: 100 }),
          withTiming(0.05, { duration: 100 }),
          withTiming(0, { duration: 100 })
        );
        // Auto-revert to idle after animation
        setTimeout(() => {
          if (currentAnim.value === state) {
            currentAnim.value = 'idle';
            priority.value = 0;
          }
        }, 600);
        break;

      case 'sad':
        scale.value = withTiming(0.95, { duration: 300 });
        opacity.value = withTiming(0.9, { duration: 300 });
        translateX.value = withSequence(
          withTiming(-3, { duration: 200 }),
          withTiming(3, { duration: 200 }),
          withTiming(0, { duration: 200 })
        );
        setTimeout(() => {
          if (currentAnim.value === state) {
            currentAnim.value = 'idle';
            priority.value = 0;
          }
        }, 1000);
        break;

      case 'sleep':
        scale.value = withTiming(0.98, { duration: 500 });
        opacity.value = withRepeat(
          withSequence(
            withTiming(0.85, { duration: 1000 }),
            withTiming(1, { duration: 1000 })
          ),
          -1, // infinite
          true
        );
        break;

      case 'jump':
        scale.value = withSequence(
          withTiming(1.15, { duration: 100 }),
          withTiming(0.95, { duration: 100 }),
          withTiming(1.05, { duration: 100 }),
          withTiming(1, { duration: 100 })
        );
        translateY.value = withSequence(
          withTiming(-15, { duration: 150, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) })
        );
        setTimeout(() => {
          if (currentAnim.value === state) {
            currentAnim.value = 'idle';
            priority.value = 0;
          }
        }, 500);
        break;

      case 'celebrate':
        scale.value = withSequence(
          withTiming(1.2, { duration: 100 }),
          withTiming(0.9, { duration: 100 }),
          withTiming(1.1, { duration: 100 }),
          withTiming(1, { duration: 100 })
        );
        translateY.value = withSequence(
          withTiming(-20, { duration: 200, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) })
        );
        rotation.value = withSequence(
          withTiming(0.1, { duration: 100 }),
          withTiming(-0.1, { duration: 100 }),
          withTiming(0.1, { duration: 100 }),
          withTiming(0, { duration: 100 })
        );
        setTimeout(() => {
          if (currentAnim.value === state) {
            currentAnim.value = 'idle';
            priority.value = 0;
          }
        }, 800);
        break;

      case 'wave':
        translateX.value = withRepeat(
          withSequence(
            withTiming(-5, { duration: 100 }),
            withTiming(5, { duration: 100 })
          ),
          3, // 3 waves
          true
        );
        setTimeout(() => {
          if (currentAnim.value === state) {
            currentAnim.value = 'idle';
            priority.value = 0;
          }
        }, 700);
        break;

      case 'pet':
        scale.value = withSequence(
          withTiming(0.9, { duration: 100 }),
          withTiming(1.05, { duration: 200 })
        );
        setTimeout(() => {
          if (currentAnim.value === state) {
            currentAnim.value = 'idle';
            priority.value = 0;
          }
        }, 500);
        break;

      case 'hidden':
        opacity.value = withTiming(0, { duration: 200 });
        break;
    }
  }, [currentAnim, priority, scale, opacity, translateY, translateX, rotation]);

  // ── Animated style — apply to the Image component ──
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotation.value}rad` },
    ],
    opacity: opacity.value,
  }));

  return {
    currentAnim,
    play,
    animatedStyle,
    // Utility: check if currently playing a high-priority animation
    isAnimating: (state: AnimationState) => currentAnim.value === state,
  };
}
```

---

## 5.2 Asset Path Resolver

Since spritesheets are downloaded (Game DLC model), create a resolver that provides the correct file system path:

**File:** `src/services/companion/assetPaths.ts`

```typescript
/**
 * Resolves paths to downloaded Luna assets.
 * Assets live in FileSystem.documentDirectory + 'companion/' after download.
 */
import * as FileSystem from 'expo-file-system';

export const COMPANION_DIR = FileSystem.documentDirectory + 'companion/';
export const SPRITESHEET_PNG = COMPANION_DIR + 'spritesheet.png';
export const SPRITESHEET_JSON = COMPANION_DIR + 'spritesheet.json';
export const DIALOGUES_FILE = COMPANION_DIR + 'dialogues.json';
export const SOUNDS_DIR = COMPANION_DIR + 'sounds/';

/** Check if the companion assets directory exists. */
export async function areAssetsInstalled(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(COMPANION_DIR);
    return info.exists;
  } catch {
    return false;
  }
}

/** Get the size of installed assets (bytes). */
export async function getAssetsSize(): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(COMPANION_DIR, { size: true });
    return (info as any).size ?? 0;
  } catch {
    return 0;
  }
}
```

## 5.3 Create Placeholder + Spritesheet LunaSprite

The component checks for downloaded assets first; falls back to an inline SVG placeholder when no spritesheet is available (e.g., before download or during development):

**File:** `src/services/companion/LunaSprite.tsx`

```tsx
import React, { memo, useEffect, useState } from 'react';
import { Image } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path, Ellipse, Circle as SvgCircle } from 'react-native-svg';
import { useAnimationEngine } from './AnimationEngine';
import { useCompanionStore } from '../../stores/companionStore';
import { SPRITESHEET_PNG, areAssetsInstalled } from './assetPaths';

interface LunaSpriteProps {
  size?: number;
  animatedStyle?: ReturnType<typeof useAnimationEngine>['animatedStyle'];
}

/**
 * Luna sprite component.
 * Loads from downloaded spritesheet PNG when available.
 * Falls back to inline SVG placeholder during development or before download.
 */
export const LunaSprite = memo(function LunaSprite({
  size = 80,
  animatedStyle,
}: LunaSpriteProps) {
  const reduceAnimations = useCompanionStore((s) => s.reduceAnimations);
  const [useSpritesheet, setUseSpritesheet] = useState(false);

  useEffect(() => {
    areAssetsInstalled().then(setUseSpritesheet);
  }, []);

  // Spritesheet mode — uses the downloaded PNG
  if (useSpritesheet) {
    return (
      <Animated.View style={[animatedStyle, { width: size, height: size }]}>
        <Image
          source={{ uri: SPRITESHEET_PNG }}
          style={{ width: size, height: size, resizeMode: 'contain' }}
          accessibilityLabel="Luna the cat"
        />
      </Animated.View>
    );
  }

  // Placeholder mode — inline SVG (pre-download / development)
  return (
    <Animated.View style={[animatedStyle, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Ellipse cx="50" cy="60" rx="28" ry="22" fill="#F5C4C4" />
        <SvgCircle cx="50" cy="38" r="22" fill="#F5C4C4" />
        <Path d="M32 28 L28 8 L42 24 Z" fill="#F5C4C4" />
        <Path d="M68 28 L72 8 L58 24 Z" fill="#F5C4C4" />
        <Path d="M34 26 L30 12 L42 24 Z" fill="#FFB3B3" />
        <Path d="M66 26 L70 12 L58 24 Z" fill="#FFB3B3" />
        <SvgCircle cx="42" cy="36" r="4" fill="#333" />
        <SvgCircle cx="58" cy="36" r="4" fill="#333" />
        <SvgCircle cx="43" cy="34" r="1.5" fill="#FFF" />
        <SvgCircle cx="59" cy="34" r="1.5" fill="#FFF" />
        <Path d="M48 42 L52 42 L50 44 Z" fill="#FF8F8F" />
        <Path d="M46 45 Q50 49 54 45" stroke="#333" strokeWidth="1.2" fill="none" />
        <Path d="M34 40 L22 38 M34 42 L22 43 M34 44 L24 48" stroke="#999" strokeWidth="0.8" strokeLinecap="round" />
        <Path d="M66 40 L78 38 M66 42 L78 43 M66 44 L76 48" stroke="#999" strokeWidth="0.8" strokeLinecap="round" />
        <Path d="M76 62 Q90 50 85 40 Q82 35 78 38" stroke="#F5C4C4" strokeWidth="6" strokeLinecap="round" fill="none" />
        <Ellipse cx="40" cy="78" rx="8" ry="5" fill="#F5C4C4" />
        <Ellipse cx="60" cy="78" rx="8" ry="5" fill="#F5C4C4" />
      </Svg>
    </Animated.View>
  );
});
```

---

## 5.4 Critical Fix: Auto-Revert Durations Must Be Data-Driven

**Issue:** The `play()` function uses hardcoded `setTimeout` values (e.g., 600ms for `'happy'`, 1000ms for `'sad'`). These don't match `ANIMATION_FRAMES[state].frames * speed` and will cause visual glitches when frame configs change.

**Fix:** Derive auto-revert timeout from `ANIMATION_FRAMES`:

```typescript
// Add a helper at the top of AnimationEngine.ts:
function getAnimationDuration(state: AnimationState): number {
  const config = ANIMATION_FRAMES[state];
  if (config.loop) return Infinity; // looping animations never auto-revert
  return config.frames * config.speed;
}

// In the play() function, replace hardcoded setTimeout values with:
setTimeout(() => {
  if (currentAnim.value === state) {
    currentAnim.value = 'idle';
    priority.value = 0;
  }
}, getAnimationDuration(state));
```

**Updated `play()` switch cases** — remove all the individual `setTimeout` calls and use a single one at the end of the `switch`:

```typescript
const play = useCallback((state: AnimationState) => {
  // ... priority check, reset transforms ...

  switch (state) {
    case 'idle':
    case 'idle_blink':
      // reset all transforms to identity
      break;
    case 'happy':
      // scale + rotation sequence (no setTimeout)
      break;
    case 'sad':
      // scale + shake sequence (no setTimeout)
      break;
    case 'sleep':
      // breathing opacity loop (no setTimeout since loop=true)
      break;
    // ... etc for all non-looping states
  }

  // SINGLE auto-revert for non-looping animations
  const duration = getAnimationDuration(state);
  if (duration < Infinity) {
    setTimeout(() => {
      if (currentAnim.value === state) {
        currentAnim.value = 'idle';
        priority.value = 0;
      }
    }, duration + 200); // +200ms buffer for the last frame to display
  }
}, [...]);

// Update validation checklist:
```

**Validation:**
- [ ] `getAnimationDuration('happy')` returns `4 * 150 = 600ms`
- [ ] `getAnimationDuration('sleep')` returns `Infinity` (loop)
- [ ] All hardcoded `setTimeout` values replaced with data-driven durations
- [ ] Auto-revert fires after animation completes, not before

---

Create the barrel export:

```typescript
export { useAnimationEngine } from './AnimationEngine';
export type { AnimationState, FrameConfig } from './AnimationEngine';

export { LunaSprite } from './LunaSprite';

export { dialogueEngine } from './DialogueEngine';
export type { DialogueContext } from './DialogueEngine';

export { areAssetsInstalled, getAssetsSize, COMPANION_DIR } from './assetPaths';
```

---

## ✅ Day 5 Validation

- [ ] `src/services/companion/AnimationEngine.ts` created with all 10 animation states
- [ ] Priority system works — higher-priority animations interrupt lower ones
- [ ] `play('happy')` triggers scale + rotation with auto-revert to idle
- [ ] `play('sleep')` triggers breathing opacity loop
- [ ] `play('hidden')` fades opacity to 0
- [ ] `play('sad')` triggers scale-down + horizontal shake with auto-revert
- [ ] `play('celebrate')` triggers jump + rotation with auto-revert
- [ ] `assetPaths.ts` created with `COMPANION_DIR`, `areAssetsInstalled()`, `getAssetsSize()`
- [ ] `LunaSprite.tsx` checks `areAssetsInstalled()` and loads spritesheet PNG from file system when available
- [ ] `LunaSprite.tsx` falls back to inline SVG placeholder when no spritesheet exists (pre-download / dev)
- [ ] `reduceAnimations` flag prevents unnecessary motion
- [ ] All asset paths point to `FileSystem.documentDirectory + 'companion/'`
- [ ] Exported from `src/services/companion/index.ts`
- [ ] App builds without TypeScript errors
