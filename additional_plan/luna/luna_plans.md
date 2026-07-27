# Luna Companion — Asset Integration Plan

## The Problem

Current architecture uses an SVG placeholder cat that looks nothing like the real Luna. We need to integrate the actual cat art while maintaining the download-on-demand model.

## Asset Model — Two-Tier DLC

| Asset | Where It Lives | When It's Used |
|-------|---------------|----------------|
| **`luna_fallback.png`** | Bundled in APK/IPA (ships with every install) | Before user downloads Luna module. Static cat avatar. |
| **`spritesheet.png`** (`luna1.png`) | Downloaded as part of `luna_assets_v1.zip` | After user downloads Luna module. Animated frames. |

### File Inventory

| File | Dimensions | Size | Purpose | Bundled? | Downloaded? |
|------|-----------|------|---------|----------|-------------|
| `luna_fallback.png` | 1024×1024 | ~80-100KB (compressed) | Static avatar when Luna not installed | ✅ Yes | ❌ No |
| `spritesheet.png` (luna1.png) | 1408×768 | 1.7MB | 24 animation frames | ❌ No | ✅ Yes |
| `spritesheet.json` | — | ~3KB | Frame coordinates for animation | ❌ No | ✅ Yes |
| `dialogues.json` | — | ~15KB | Speech bubble text | ❌ No | ✅ Yes |
| `sounds/*.mp3` | — | ~500KB | Sound effects | ❌ No | ✅ Yes |

## Spritesheet Specs (luna1.png)

| Property | Value |
|----------|-------|
| Image size | 1408 × 768 px |
| Frame width | 1408 / 4 = **352 px** |
| Frame height | 768 / 6 = **128 px** |
| Grid | **4 columns × 6 rows** |
| Total frames | **24 frames** |
| Animation states | idle, walk, run, jump, happy, sad, sleep, wave |

### Grid Layout

```
Row 0:   idle   | idle_blink | walk_1   | walk_2     (y: 0)
Row 1:   walk_3 | walk_4     | run_1    | run_2      (y: 128)
Row 2:   run_3  | run_4      | jump_1   | jump_2     (y: 256)
Row 3:   happy_1| happy_2    | happy_3  | happy_4    (y: 384)
Row 4:   sad_1  | sad_2      | sad_3    | sleep_1    (y: 512)
Row 5:   sleep_2| sleep_3    | wave_1   | wave_2     (y: 640)
```

## spritesheet.json

```json
{
  "meta": {
    "image": "spritesheet.png",
    "size": { "w": 1408, "h": 768 },
    "frame_w": 352,
    "frame_h": 128,
    "columns": 4,
    "rows": 6,
    "total_frames": 24,
    "version": "1.0.0"
  },
  "frames": {
    "idle":       { "frame": { "x": 0,    "y": 0   }, "w": 352, "h": 128, "duration": 200 },
    "idle_blink": { "frame": { "x": 352,  "y": 0   }, "w": 352, "h": 128, "duration": 150 },
    "walk_1":     { "frame": { "x": 704,  "y": 0   }, "w": 352, "h": 128, "duration": 120 },
    "walk_2":     { "frame": { "x": 1056, "y": 0   }, "w": 352, "h": 128, "duration": 120 },
    "walk_3":     { "frame": { "x": 0,    "y": 128 }, "w": 352, "h": 128, "duration": 120 },
    "walk_4":     { "frame": { "x": 352,  "y": 128 }, "w": 352, "h": 128, "duration": 120 },
    "run_1":      { "frame": { "x": 704,  "y": 128 }, "w": 352, "h": 128, "duration": 80 },
    "run_2":      { "frame": { "x": 1056, "y": 128 }, "w": 352, "h": 128, "duration": 80 },
    "run_3":      { "frame": { "x": 0,    "y": 256 }, "w": 352, "h": 128, "duration": 80 },
    "run_4":      { "frame": { "x": 352,  "y": 256 }, "w": 352, "h": 128, "duration": 80 },
    "jump_1":     { "frame": { "x": 704,  "y": 256 }, "w": 352, "h": 128, "duration": 150 },
    "jump_2":     { "frame": { "x": 1056, "y": 256 }, "w": 352, "h": 128, "duration": 150 },
    "happy_1":    { "frame": { "x": 0,    "y": 384 }, "w": 352, "h": 128, "duration": 150 },
    "happy_2":    { "frame": { "x": 352,  "y": 384 }, "w": 352, "h": 128, "duration": 150 },
    "happy_3":    { "frame": { "x": 704,  "y": 384 }, "w": 352, "h": 128, "duration": 150 },
    "happy_4":    { "frame": { "x": 1056, "y": 384 }, "w": 352, "h": 128, "duration": 150 },
    "sad_1":      { "frame": { "x": 0,    "y": 512 }, "w": 352, "h": 128, "duration": 250 },
    "sad_2":      { "frame": { "x": 352,  "y": 512 }, "w": 352, "h": 128, "duration": 250 },
    "sad_3":      { "frame": { "x": 704,  "y": 512 }, "w": 352, "h": 128, "duration": 250 },
    "sleep_1":    { "frame": { "x": 1056, "y": 512 }, "w": 352, "h": 128, "duration": 500 },
    "sleep_2":    { "frame": { "x": 0,    "y": 640 }, "w": 352, "h": 128, "duration": 500 },
    "sleep_3":    { "frame": { "x": 352,  "y": 640 }, "w": 352, "h": 128, "duration": 500 },
    "wave_1":     { "frame": { "x": 704,  "y": 640 }, "w": 352, "h": 128, "duration": 150 },
    "wave_2":     { "frame": { "x": 1056, "y": 640 }, "w": 352, "h": 128, "duration": 150 }
  },
  "animations": {
    "idle":    { "frames": ["idle", "idle_blink"],              "loop": true,  "speed": 0.5 },
    "walk":    { "frames": ["walk_1", "walk_2", "walk_3", "walk_4"], "loop": true,  "speed": 1.0 },
    "run":     { "frames": ["run_1", "run_2", "run_3", "run_4"],     "loop": true,  "speed": 1.5 },
    "jump":    { "frames": ["jump_1", "jump_2"],                     "loop": false, "speed": 1.0 },
    "happy":   { "frames": ["happy_1", "happy_2", "happy_3", "happy_4"], "loop": false, "speed": 1.0 },
    "sad":     { "frames": ["sad_1", "sad_2", "sad_3"],             "loop": false, "speed": 0.8 },
    "sleep":   { "frames": ["sleep_1", "sleep_2", "sleep_3"],       "loop": true,  "speed": 0.3 },
    "wave":    { "frames": ["wave_1", "wave_2"],                     "loop": false, "speed": 1.2 }
  }
}
```

## Implementation

### Step 1: Bundle the Fallback Avatar

- Compress `luna_companion_cat_avatar.png` from 1024×1024 / 334KB to ~80-100KB (TinyPNG or `sharp`)
- Place in `mobile/src/assets/companion/luna_fallback.png`
- Metro bundles it into the APK/IPA automatically

### Step 2: Rewrite LunaSprite.tsx

**File:** `mobile/src/services/companion/LunaSprite.tsx`

Replace the SVG placeholder with a clean switch between bundled avatar and downloaded spritesheet:

```typescript
import React, { useState, useEffect } from 'react';
import { Image } from 'react-native';
import Animated from 'react-native-reanimated';
import { areAssetsInstalled, SPRITESHEET_PNG } from './assetPaths';
import LunaFallbackImage from '../../assets/companion/luna_fallback.png';

interface LunaSpriteProps {
  size?: number;
  animatedStyle?: any;
}

export const LunaSprite = React.memo(function LunaSprite({
  size = 80,
  animatedStyle,
}: LunaSpriteProps) {
  const [useSpritesheet, setUseSpritesheet] = useState(false);

  useEffect(() => {
    areAssetsInstalled().then(setUseSpritesheet);
  }, []);

  // Downloaded spritesheet — animated frames
  if (useSpritesheet) {
    return (
      <Animated.View style={[animatedStyle, { width: size, height: size }]}>
        <Image
          source={{ uri: SPRITESHEET_PNG }}
          style={{ width: size, height: size, resizeMode: 'contain' }}
        />
      </Animated.View>
    );
  }

  // Bundled fallback — static avatar
  return (
    <Animated.View style={[animatedStyle, { width: size, height: size }]}>
      <Image
        source={LunaFallbackImage}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
    </Animated.View>
  );
});
```

### Step 3: Package the Asset Zip

**Contents of `luna_assets_v1.zip`:**

```
companion/
  spritesheet.png       (luna1.png, renamed)
  spritesheet.json      (frame coordinates, above)
  dialogues.json        (existing)
  sounds/
    meow.mp3
    purr.mp3
    yawn.mp3
    celebrate.mp3
```

Note: `luna_fallback.png` is NOT in the zip. It ships bundled with the app.

### Step 4: Update AnimationEngine.ts

Load `spritesheet.json` at runtime to drive frame-based animation:

```typescript
import { SPRITESHEET_PNG, SPRITESHEET_JSON } from './assetPaths';

let frameData: any = null;

async function loadFrameData() {
  if (frameData) return frameData;
  const response = await fetch(SPRITESHEET_JSON);
  frameData = await response.json();
  return frameData;
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/assets/companion/luna_fallback.png` | **New** — compressed avatar image |
| `src/services/companion/LunaSprite.tsx` | Replace SVG with bundled `luna_fallback.png` + switch to spritesheet when installed |
| `src/services/companion/AnimationEngine.ts` | Load `spritesheet.json`, drive frame-based animation |
| `luna_assets_v1.zip` | Add `spritesheet.png` (luna1.png) + `spritesheet.json` |

## Pure Opt-In Recap (from ADR-003)

| State | What User Sees | Luna Asset Used |
|-------|---------------|-----------------|
| Fresh install | Clean dashboard, no cat | Nothing |
| Settings → Feature Store | "Luna Cat Companion" listed | "Download" button |
| After download completes | Cat appears — static avatar | `luna_fallback.png` (bundled) |
| Spritesheet loaded | Cat animates | `spritesheet.png` (downloaded) |
| Uninstall | Cat vanishes | Nothing |

## Validation

- [ ] `luna_fallback.png` compressed (~80-100KB), placed in `assets/companion/`
- [ ] `LunaSprite.tsx` shows avatar when `useSpritesheet` is false
- [ ] `LunaSprite.tsx` shows `spritesheet.png` when `useSpritesheet` is true
- [ ] `spritesheet.json` frame coordinates are within bounds (x: 0–1056, y: 0–640)
- [ ] No overlapping or negative coordinates
- [ ] `spritesheet.json` is included in the zip and loads correctly
- [ ] App does NOT crash if zip is missing (graceful fallback to bundled avatar)
- [ ] `npx tsc --noEmit` passes with zero new errors
- [ ] SVG cat is entirely removed — no trace of geometric placeholder
