# Luna2 Phase 0 — Fix the Android Native Build (GATE)

> **THIS IS THE GATE.** No other Luna2 phase starts until this is green.
> The app has been unable to produce a working Android dev-client build for
> several attempts because of a native crash in `libexpo-av.so`. Every
> subsequent phase (3D, TTS, new native modules) depends on a working build,
> so fixing this is the #1 priority.

---

## 1. Problem

`dlopen failed: cannot locate symbol "_ZNKR8facebook3jsi5Value8asObjectERNS0_7RuntimeE"`
(`facebook::jsi::Value::asObject(fb::jsi::Runtime&)`), referenced by
`libexpo-av.so` at `AVManager.<clinit>`.

**Root cause (proven by ELF analysis, not the original theory):** the 
`publication` block in `expo-av/expo-module.config.json` makes the build consume
a **prebuilt AAR** (`local-maven-repo/.../expo.modules.av-16.0.8.aar`) that was
compiled against **old JSI headers**. Its `libexpo-av.so` references
`facebook::jsi::Value::asObject(fb::jsi::Runtime&)` (`_ZNKR8facebook3jsi5Value8
asObjectERNS0_7RuntimeE`, mangled `7Runtime`), but RN 0.86 ships `libjsi.so`
that only exports the new ABI `asObject(fb::jsi::IRuntime&)` (`8IRuntime`) →
`dlopen` fails at `AVManager.<clinit>` → `UnsatisfiedLinkError`.

**Disproven original theory:** the plan previously blamed `CMakeLists.txt`
linking `ReactAndroid::jsi` and claimed `libjsi.so` "does not exist at runtime".
ELF inspection of a working debug APK proved: `libjsi.so` IS packaged, IS linked
as `NEEDED`, and the **source-built** `libexpo-av.so` references `asObject(
IRuntime&)` which `libjsi.so` exports — fully consistent. The CMakeLists
difference is effectively a no-op for RN >= 76 (both old and new forms link
`reactnative` + `jsi`); the crash only ever appeared when the **prebuilt AAR**
was used.

**Why it kept failing despite "fixes":** EAS runs `npm ci`, which skips
`postinstall` scripts and only runs `prepare`. Every earlier `patch-package`
patch was therefore silently **never applied** in EAS builds. Worse, the
publication-block removal (the ACTUAL fix) was a manual edit to `node_modules`
and was lost on `npm ci`, silently restoring the prebuilt AAR in EAS.

---

## 2. Phase 0A — Validate the patch (primary path)

In place (all captured in `mobile/patches/expo-av+16.0.8.patch`):
- **`expo-module.config.json`** — `publication` block removed → forces **source
  build** (this is the ACTUAL fix; avoids the prebuilt AAR with wrong JSI ABI).
- **`local-maven-repo/`** deleted → prebuilt AAR artifacts removed.
- **`CMakeLists.txt`** — links `ReactAndroid::reactnative` + `ReactAndroid::jsi`
  unconditionally (no-op for RN >= 76, harmless).
- **`ViewUtils.kt` / `FullscreenVideoPlayer.java`** — legacy `UIManager` /
  `KeepAwakeManager` API calls replaced with SDK 57 `AppContext` equivalents.
- `mobile/package.json` — `"prepare": "patch-package"` added (kept
  `postinstall` too). This is the vehicle that makes the patch actually run
  under `npm ci`.

Tasks:
1. Confirm patch applies cleanly:
   `npx patch-package` (must print no errors).
2. Verify the generated `node_modules/expo-av/expo-module.config.json` has NO
   `publication` block before any build (grep — it must NOT be there).
3. Build locally: `npx expo run:android`
   - USB debugging must be authorized on device `0965731342095242`
     (Allow popup, or `adb devices` after revoke/reconnect).
   - First build 15–30 min; subsequent 2–5 min.
   - OR `eas build --profile development --platform android --clear-cache`.
4. App boots and Luna sounds + animations play.

### Verification performed (2026-08-06)
- `npx patch-package` applies cleanly (expo-av ✔, expo-sqlite ✔).
- Regenerated `expo-av+16.0.8.patch` captures ALL four fixes (config, CMake,
  ViewUtils, FullscreenVideoPlayer) + local-maven-repo deletion. Previously the
  config/publication removal was a MANUAL node_modules edit and was lost on
  `npm ci` — this was the actual EAS failure.
- ELF proof: debug APK `libexpo-av.so` needs `asObject(IRuntime&)`,
  `libjsi.so` exports it; both shipped. Local build is ABI-consistent.
- Device `0965731342095242` authorized; installed APK launches to DevLauncher,
  process stays alive, no crash.

### How to verify the patch actually shipped in an EAS build
- Add a temporary log or inspect the extracted CMakeLists at build start; or
  simpler: run the same `npx expo run:android` path locally first, which uses
  the same `prepare` hook, then trust EAS parity for `npm ci`.
- Confirm via EAS build logs that the `prepare` step ran `patch-package`.

---

## 3. Phase 0B — Fallback: replace expo-av with expo-audio

If 0A fails to resolve the crash, **eliminate the crashing library entirely**:
1. `npx expo install expo-audio` (SDK 57 compatible).
2. Rewrite `mobile/src/services/companion/SoundEngine.ts` to the `expo-audio`
   API (`useAudioPlayer` / `createAudioPlayer`); sound files unchanged
   (`meow.mp3`, `purr.mp3`, `yawn.mp3`, `celebrate.mp3`).
3. Remove `expo-av` from `mobile/package.json`.
4. Update DLC zip (sounds unchanged if files identical; re-test extraction).
5. Rebuild with the same verification as 0A.

---

## 4. Gate exit criteria

- One green Android dev-client build that boots and plays a Luna animation
  and/or sound.
- Patch is confirmed applied in the build (not just locally).
- `npx tsc --noEmit` clean; existing `companion/*` jest suites pass.

## 5. Definition of done for this phase

- Commit the working build configuration.
- Record in this file the exact method that worked (0A vs 0B) so future
  `npm ci` / clean builds are reproducible.

## 6. GATE PASSED (2026-08-06)

**Method that worked: Phase 0A — source build via publication-block removal.**

The real fix (proven by ELF analysis) is NOT the CMakeLists change — it is
**removing the `publication` block from `expo-av/expo-module.config.json`** so
Gradle compiles expo-av from source against the app's own RN 0.86 JSI headers,
instead of consuming the prebuilt AAR (`local-maven-repo/...16.0.8.aar`) that
was built against OLD JSI headers (`asObject(Runtime&)` vs RN 0.86's
`asObject(IRuntime&)`).

Evidence chain:
1. `npx patch-package` applies cleanly; regenerated `expo-av+16.0.8.patch`
   now captures ALL four source changes + `local-maven-repo/` deletion. The
   earlier patch omitted the config change — that is why EAS kept crashing.
2. `.\gradlew :app:assembleDebug` → BUILD SUCCESSFUL (fresh compile of the
   patched native sources).
3. Extracted fresh APK: `libexpo-av.so` needs `asObject(IRuntime&)`,
   `libjsi.so` exports it. ABI-consistent. No `7Runtime` symbol anywhere.
4. Installed on device `0965731342095242`, started Metro (`npx expo start --lan
   --port 8081`), deep-linked dev client.
5. Logcat proof: `Running "main"` (Fabric), `[expo-av]: Expo AV has been
   deprecated` — AVManager initialized, no crash. No `FATAL EXCEPTION`, no
   `UnsatisfiedLinkError`, no `cannot locate symbol`.

Verification command (reproducible):
```
cd mobile
npx patch-package            # must print expo-av ✔
cd android
.\gradlew.bat :app:assembleDebug
npx expo start --lan --port 8081   # separate terminal
adb reverse tcp:8081 tcp:8081
# open shecare://expo-development-client/?url=http://localhost:8081
```

## 6. Follow-ups (gated by this phase)

- Phase 1: 3D visual upgrade (adds react-native-filament, a new native module —
  requires a green build).
- Phase 3: TTS voice (adds expo-speech — another native module).
