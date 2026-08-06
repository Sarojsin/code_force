# Luna2 Phase 1 — 3D Visual Upgrade (via cat.glb + react-native-filament)

> Phase 1 delivers the 3D Luna. It **cannot start until the native build
> blocker is green** — see `luna2phase0_plan.md` (Phase 0 gate). This phase
> assumes a working Android dev-client build.

---

## 0. Prerequisite

- Phase 0 gate green (build boots, Luna animation/sound works).
- Decision locked: `cat.glb` ships **only** in the DLC bundle — it is NEVER
  compiled into the base app. The base app keeps only the 2D `LunaSprite`
  fallback. This keeps the install size lean (~1 MB saved on every install).

---

## 1. Add react-native-filament to mobile

1. `npx expo install react-native-filament@^1.11.0`
   - v1.11.0 (margelo, 2026-05-27) supports RN 0.81+ and New Architecture.
   - Requires `react-native-reanimated` (mobile has 4.5.0) and
     `react-native-worklets` (mobile has 0.10.0). Both already present.
2. Add `"glb"` to `assetExts` in `mobile/metro.config.js`
   (model: `getDefaultConfig(...).resolver?.assetExts ?? []` + `'glb'`).
3. Add to `mobile/src/types/assets.d.ts`:
   ```ts
   declare module '*.glb' {
     const value: number; // bundled asset id
     export default value;
   }
   ```
4. Run `npx tsc --noEmit` — must stay clean.

---

## 2. Bring the 3D renderer into mobile

Copy + adapt from the `cat/` prototype (keep `cat/` as archived reference;
source of truth becomes `mobile/`):

| Source (`cat/`) | Destination (`mobile/`) |
|---|---|
| `components/TalkingCat.tsx` | `src/services/companion/3d/TalkingCat.tsx` |
| `types/glb.d.ts` | merged into `src/types/assets.d.ts` (above) |

> **`cat.glb` is NOT copied into `mobile/src/assets/`.** It is delivered via
> the DLC zip (§5) and loaded from the filesystem at runtime. The only
> exception: a tiny placeholder is never bundled — if the model is missing,
> the component must fall back to 2D rather than render blank.

`TalkingCat.tsx` is already self-contained and 2D/3D-agnostic:
- Props: `{ size, pose, modelSource }` where `LunaPose = { jaw, headTilt, headNod, blink, breath, tail, ear, talking }`.
- `modelSource` is a **filesystem path** (DLC install dir) or a bundled asset
  ref (dev/pre-install prototype only) — load via
  `useModelLoader` / `useModel` with `sourceType: 'file'` when the path is a
  DLC file, and `'asset'` otherwise.
- Drives bones through `TransformManager.setEntityRotation` in a render
  callback (worklet).
- Bone name fallback matching (`BONE_CANDIDATES`) handles renamed rig bones.

Adaptations:
- **Load from FS:** resolve model path via
  `FileSystem.documentDirectory + COMPANION_DIR + 'models/cat.glb'`
  (use `mobile/src/services/companion/assetPaths.ts` constants — add a
  `CAT_GLB_PATH` constant there).
- Add an **error boundary** wrapper: if Filament init/model load fails on
  low-end devices OR the model file is missing (not yet installed), fall back
  to the existing 2D `LunaSprite`.
- **Loading skeleton:** while the 3D model is loading from disk, show a
  skeleton placeholder (e.g. `react-native-skeleton-placeholder` cat-shaped
  block) instead of a blank area.
- Import paths → `@/` aliases if used elsewhere in mobile (keep relative).
- Guard 3D render to overlay-visible state only (perf).

---

## 3. Pose mapper — AnimationState → LunaPose

New file `mobile/src/services/companion/3d/poseMapper.ts`:

```ts
export function animationToPose(state: AnimationState, t: number): LunaPose
```

Map the existing Reanimated state machine states to bone targets:
| `AnimationState` | Pose intent |
|---|---|
| `idle` | breath ~0.05 sine, blink periodic, tail slow sway |
| `idle_blink` | blink 1.0 pulse |
| `happy` | headNod wiggle, jaw open, tail fast wag, ear perk |
| `sad` | headTilt down, ears flat, tail droop, slow breath |
| `sleep` | eyes closed (blink 1.0 held), slow deep breath, ears flat |
| `jump` | whole-body translate via parent, tail up |
| `wave` | headTilt + tail up, ear perk |
| `celebrate` | headNod bounce, jaw open, tail fast wag |
| `pet` | ears press back, headTilt, purr breath |
| `hidden` | (opacity handled by Reanimated wrapper) |

Design:
- `t` = elapsed seconds (drives sine/timing).
- Keep pure + deterministic → unit-testable.
- Pose is written to the `useSharedValue<LunaPose>` inside `TalkingCat`.

---

## 4. Wire into the UI

### 4.1 `mobile/src/screens/companion/LunaOverlay.tsx`
- Line ~367: replace `LunaSprite` with `TalkingCat` when
  `installStatus === 'ready'` (3D available). Keep `LunaSprite` as pre-install
  fallback.
- Keep the Reanimated wrapper (`useAnimationEngine().animatedStyle`) for
  translate/scale/opacity — 3D replaces only the character render, not the
  float/pet/jump motions.
- Apply the `perftest.md` **R5 fix** (float animation recreated every render,
  lines 111–122) before adding 3D on top.

### 4.2 `mobile/src/screens/profile/SettingsScreen.tsx`
- Line ~277 preview: swap `LunaSprite` → `TalkingCat` (size 60) when installed.

### 4.3 `mobile/src/screens/companion/LunaInstallScreen.tsx`
- Update feature copy: "3D Luna" replaces the static cat face once installed.

---

## 5. DLC bundle v2.0.0 (ship the 3D model via download — DLC-only)

1. Build new zip `luna_assets_v2.0.0.zip` containing:
   - `models/cat.glb` (the 3D model — **the only place it ships**)
   - existing `spritesheet.png`, `spritesheet.json`, `dialogues.json`,
     `sounds/{meow,purr,yawn,celebrate}.mp3`
2. Compute **base64-SHA256** checksum (matches mobile `computeChecksum()` in
   `assetDownloader.ts` — hashes the base64 string, not raw bytes).
3. Update `backend/app/modules/luna/routes.py` metadata:
   - `version = "2.0.0"`, `size_mb` (+ ~0.95 for cat.glb), `checksum_sha256`,
     `download_url`.
4. Update `assetDownloader.ts` download URL if versioned by filename.
5. Store the new zip under
   `backend/app/modules/luna/assets/luna_assets_v2.0.0.zip`.
6. **Do NOT mirror `cat.glb` into `mobile/src/assets/companion/`.** The base
   app ships only `luna_fallback.png` (2D). The 3D model exists solely in the
   DLC zip and the extracted `FileSystem` install dir.

---

## 6. Performance & accessibility

- 3D renders only when overlay focused + installed (`isFocused`).
- `reduceAnimations` → lower breath/blink frequency in pose mapper.
- Touch targets stay >= 44×44; `accessibilityLabel` on Luna unchanged.
- Add `useReducedMotion` respect in pose mapper (disable tail/breath sine).

---

## 7. Tests & verification

> **EXECUTION STATUS (2026-08-06):** All engineering tasks DONE, device native
> gate GREEN. Remaining: visual confirmation of the 3D cat on Home after the
> DLC install (needs an in-app install tap).

- `mobile/src/__tests__/companion/3d/poseMapper.test.ts` — mapping matrix:
  every `AnimationState` → expected bone sign/direction; determinism;
  reducedMotion / reduceAnimations; hidden → neutral; unknown → idle.
- `mobile/src/__tests__/companion/3d/modelSource.test.ts` — model source
  resolution: DLC path used when installed AND file exists; bundled fallback
  refused; missing-file → 2D fallback.
- jest: existing `companion/*` suites still pass (8 suites / 53 tests).
- `npx tsc --noEmit` clean.
- **NDK toolchain patch (§6.1) was MISSING** — NDK `27.0.12077973` was
  reinstalled/updated and line 366 `c++_shared` case was empty, which broke
  `react-native-worklets-core` C++ link (`undefined std::__ndk1::*`). Re-applied
  `list(APPEND ANDROID_CXX_STANDARD_LIBRARIES "-lc++_shared")`. This must be
  re-checked whenever the NDK is updated (AGENTS.md §6.1).
- Manual device checklist:
  1. Fresh install (no DLC) → 2D `LunaSprite` fallback + loading skeleton if
     a download is in progress.
  2. Download Luna → 3D cat appears on Home dashboard (skeleton while model
     loads from disk).
  3. pet / wave / happy / celebrate / sleep / sad animations read correctly.
  4. `reduceAnimations` on → calmer motion.
  5. Low-end device (or forced Filament error) → graceful 2D fallback.
  6. Uninstall → 3D removed, 2D fallback returns; model file cleaned up.

**Device verification (done 2026-08-06, device `0965731342095242`):**
- Fresh APK (318.5 MB debug) with `libreact-native-filament.so` +
  `librnworklets.so` + `libc++_shared.so` + `libjsi.so` installed.
- ELF check: filament/rnworklets/expo-av reference new-JSI
  `asObject(IRuntime&)`; `libjsi.so` exports it. ABI-consistent, no
  `7Runtime` symbols.
- App boots to `.MainActivity`, RN `Running "main"` (Fabric); Filament
  initializes at boot: `FilamentProxy: Initializing JFilamentProxy...`,
  `Creating FilamentProxy (#1)... ✅`, `Creating Worklet Context... Successfully
  created WorkletContext! Installing global Dispatcher...`, `Creating Bullet...`.
- No `FATAL EXCEPTION` / `UnsatisfiedLinkError` / `dlopen` failures.
- DLC endpoint live: `/features/luna/metadata` → `2.0.0`, checksum
  `7f4a80...aa5`; zip downloads at 2,695,385 bytes (exact file size).
- Metro `--lan` required (the `--localhost` IPv6-only bind blocks the device
  websocket) — same gotcha as Phase 0.

**Remaining manual step:** in-app Luna install tap → confirm the 3D cat renders
on Home (checklist items 2–6).

---

## 8. Exit criteria (Phase 1)

- Green Android dev-client build (Phase 0).
- Installed Luna renders as an animated 3D cat loaded **from the DLC
  filesystem path**; pre-install shows 2D fallback + loading skeleton.
- `cat.glb` exists ONLY in the DLC zip + install dir — never in the base app
  bundle. Base app size unchanged by the model.
- `react-native-filament` is a mobile dependency; `glb` resolvable; tsc clean.
- DLC metadata at `2.0.0` with correct base64-SHA256 checksum.
- poseMapper fully unit-tested; model-source + 3D-install integration tests
  green; overlay perf fix applied.

## 9. Follow-ups (later phases)

- Personality/memory: Phase 2
- TTS voice + lip-sync: Phase 3
- Backend sync: Phase 4
- Diary/cycle event reactions: Phase 5
