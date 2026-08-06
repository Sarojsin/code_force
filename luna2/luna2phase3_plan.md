# Luna2 Phase 3 — TTS Voice ("Luna speaks", opt-in)

> Phase 3 gives Luna an audible voice via `expo-speech`, wired into the speech
> bubble pipeline, with 3D lip-sync (jaw bone already exposed on `LunaPose`).
> **Off by default**; user opts in via Settings. Native `expo-speech` 57
> requires no extra native config on Android and only a pod install on iOS.

---

## 1. Dependency

- `npx expo install expo-speech` (picks ~57.0.0 for SDK 57).
- Android: no additional setup. iOS: `cd ios && pod install` on a Mac build.

---

## 2. VoiceService

New `mobile/src/services/companion/voiceService.ts`:

```ts
interface VoiceService {
  isEnabled(): boolean;                 // read from settings store
  setEnabled(v: boolean): Promise<void>; // triggers voice resolution on first enable
  speak(text: string, opts?: SpeakOpts): Promise<void>; // stop previous first
  stop(): void;
  getVoiceId(): string | undefined;     // persisted deterministic voice
  onSpeaking(cb: (speaking: boolean) => void): () => void; // for jaw sync
}
```

Implementation notes:
- `Speech.speak(text, { voice, rate, pitch, language, onDone, onStopped })`.
- **Deterministic voice selection (critical gap):** `getAvailableVoicesAsync()`
  ordering varies by device, so you must NOT just "pick the first female
  voice" every session. Instead:
  1. On first `setEnabled(true)`: fetch voices, score them —
     prefer `quality === 'enhanced'` (fallback `'default'`), then
     `gender === 'female'` (fallback any); within ties, prefer lower index
     for stability.
  2. Persist the winning `voice.identifier` in `companion_metadata`
     (`pref.speechVoiceId`).
  3. On subsequent sessions: use the persisted id; if it's no longer
     available, re-resolve and persist the new id.
  4. Fallback: default system voice when no match.
- Config surface: rate + pitch stored in `companion_metadata`
  (`pref.speechRate`, `pref.speechPitch`) alongside the voice id.
- **Mute integration:** if `muteSounds` is on OR `speakEnabled` is off → no-op.
- **Lifecycle:** `Speech.stop()` on app background, overlay hidden, or new
  utterance.
- Single active utterance; subsequent `speak` cancels previous.

---

## 3. Wiring

### 3.1 Speech bubble → voice (bubble/speech duration sync)

In `LunaOverlay.tsx`, wherever `show`/speech bubble text is set (EventEngine
`useSpeechBubble` hook), after displaying the bubble:
- call `voiceService.speak(text)` if enabled;
- emit speaking state so the pose mapper opens the jaw.
- **Duration sync (critical gap):** the bubble currently auto-dismisses on a
  fixed timer. If TTS is enabled, the bubble must stay visible until speech
  finishes:
  - Use the utterance's `onDone` / `onStopped` callback to dismiss the bubble
    (instead of the fixed timer), OR
  - dynamically extend the bubble timer to `max(defaultShowMs,
    estimatedSpeechDurationMs)` and dismiss on `onDone`.
  - If TTS is disabled, keep the existing fixed-timer behavior.

### 3.2 3D lip-sync

- `LunaPose.talking` (already in `TalkingCat`/`LunaPose`) → jaw rotation.
- While speaking: pose mapper sets `jaw = 0.6 * (0.5 + 0.5*sin(t*8))`
  (approx syllable cadence).
- `onDone` → `talking = false`; clamp total speaking duration to a max
  (avoid stuck-open jaw if callback is missed).
- If Phase 1 fallback (2D sprite) is active, lip-sync is skipped
  (bubble-only).

### 3.3 Settings toggle

In `mobile/src/screens/profile/SettingsScreen.tsx` add:
- Row "Luna speaks" (switch, default **off**).
- Rate / pitch sliders (visible only when enabled).
- A "Test voice" button → `voiceService.speak("Hi, I'm Luna!")`.
- Persist via `companion_metadata` (`pref.speechEnabled` etc.) + store.

### 3.4 Reduced motion / accessibility

- Respect `muteSounds` and OS silent mode intent; TTS is separate from
  sound effects but still gated by the same mute setting.
- Add `accessibilityRole="switch"` + `accessibilityLabel` on the toggle.
- Honor `reduceAnimations` — irrelevant to TTS, but keep jaw sync smooth.

---

## 4. Files touched

- `mobile/package.json` (add expo-speech)
- `mobile/src/services/companion/voiceService.ts` (new)
- `mobile/src/services/companion/3d/poseMapper.ts` (talking → jaw)
- `mobile/src/screens/companion/LunaOverlay.tsx` (speak on bubble)
- `mobile/src/screens/profile/SettingsScreen.tsx` (toggle + sliders + test)
- `mobile/src/stores/companionStore.ts` / `companion_metadata` (prefs)
- DLC zip (if any bundled voice assets/pref schema change)

---

## 5. Tests & verification

- `mobile/src/__tests__/companion/voiceService.test.ts`:
  - disabled → `speak` no-ops; enabled → calls `Speech.speak`.
  - `muteSounds` gate respected.
  - single-utterance cancellation.
  - rate/pitch passthrough.
  - **voice resolution:** picks `enhanced`+`female` voice on first enable;
    persists `identifier`; reuses persisted id on later sessions; re-resolves
    when persisted id is missing; falls back to default.
  - **bubble sync:** bubble remains visible until `onDone`; fixed timer used
    when TTS off.
- **Integration — bubble → voice pipeline:** `voicePipelineIntegration.test.ts`
  — bubble text shown → `voiceService.speak` invoked → `onSpeaking` → jaw
  pose mapper receives `talking=true` → `onDone` → bubble dismissed, jaw
  closes (mocked `expo-speech` + Reanimated shared value assertions).
- jest: `expo-speech` mocked at module boundary.
- `tsc --noEmit` clean.
- Manual:
  1. Default install → Luna silent (toggle off).
  2. Enable → bubble text is spoken; jaw moves on 3D cat; bubble stays until
     speech ends.
  3. Mute sounds on → no speech.
  4. Background the app → speech stops.
  5. Test-voice button works; rate/pitch change audible.
  6. Same voice across app restarts (persisted id).

---

## 6. Exit criteria (Phase 3)

- `expo-speech` installed; builds green on Android (iOS pod note in README).
- Opt-in toggle in Settings; off by default; persists.
- Speech plays on bubble text; 3D jaw lip-sync when speaking; bubble stays
  visible until speech finishes.
- Deterministic voice: same persisted voice across sessions, with fallback.
- Mute/lifecycle respected; tests green; tsc clean.

---

## 7. Execution status

### 7.1 IMPLEMENTED

- `expo-speech@~57.0.1` installed via `npx expo install`; patch-package
  re-applied (expo-av, expo-sqlite) cleanly.
- `mobile/src/services/companion/voiceService.ts` (new): full `VoiceService`
  surface + pure exported `resolveVoice(voices)` scorer.
  - Scoring: `quality.toLowerCase() === 'enhanced'` (+1000) > `'default'`
    (+500); `name.toLowerCase().includes('female')` (+100) bonus; tie-break
    by lower index. `expo-speech` `Voice` has NO `gender` field, so the
    female preference is a name-substring heuristic (works on Android
    voices that embed gender in the name; neutral on iOS, where
    `Enhanced` remains the primary signal).
  - Prefs persisted as a nested `memory.speech` object on
    `companion_metadata` (`{ enabled, voiceId, rate, pitch }`), merged on
    `hydrate`. **Deviation:** plan §2 named the keys `pref.speechVoiceId`
    etc.; stored under `memory.speech` instead to match the existing
    `memory` blob convention — mobile-only, no API contract impact.
  - `setEnabled(true)` resolves + persists the deterministic voice;
    `speak` stops the previous utterance first; `getAvailableVoicesAsync`
    throw falls back to the persisted id.
- `companionStore.ts`: `SpeechPrefs` + `DEFAULT_SPEECH_PREFS`
  (`enabled:false, voiceId:null, rate:1, pitch:1`), state fields
  `speakEnabled/speechVoiceId/speechRate/speechPitch`, `setSpeechPref`
  action, `hydrate`/`reset` wiring.
- Bubble hold-until-done in `EventEngine.useSpeechBubble` (plan §3.1):
  voice enabled → `voiceService.speak(text)` and dismiss on
  `onDone`/`onStopped`, with a `max(durationMs, 15000)` safety timer;
  disabled → existing fixed timer; `dismiss`/unmount stops speech.
- 3D lip-sync (plan §3.2): `poseMapper` gains `PoseOptions.talking` →
  `jaw = 0.6 * (0.5 + 0.5*sin(t*8))` + `pose.talking = true` (skipped for
  `hidden`); threaded through `Luna3D` → `TalkingCat` → `CatScene` as a
  `SharedValue<boolean>` (per-component `useSharedValue(false)` fallback).
- `LunaOverlay.tsx`: subscribes `voiceService.onSpeaking` → `talking` SV,
  passes it to `Luna3D`; `voiceService.stop()` on app background and when
  `isHidden` flips true.
- `SettingsScreen.tsx` (plan §3.3): "Luna Speaks" toggle (off by default),
  rate/pitch `@react-native-community/slider` rows (shown only when
  enabled), and a "Test Voice" row.
- `jest.setup.js`: `expo-speech` mock (speak/stop/getAvailableVoicesAsync
  as jest.fn + `VoiceQuality`).
- Tests (all green):
  - `voiceService.test.ts` (16): resolveVoice scoring/tie-breaks/empty,
    isEnabled gating, setEnabled resolve+persist, speak no-op/stops
    previous/rate-pitch passthrough/overrides/onSpeaking lifecycle/throw
    fallback, resolveVoiceId reuse/re-resolve/fallback, stop.
  - `voicePipelineIntegration.test.tsx` (6): `memory.speech` persistence
    round-trip + hydrate restore, deterministic voice end-to-end, muted
    silence, bubble hold-until-`onDone`, fixed-timer dismiss when disabled,
    dismiss stops speech.
- Full mobile suite: **49 suites / 681 tests pass**; `tsc --noEmit` clean.

### 7.2 Deviations / notes

- "Test voice" plays only when `speakEnabled` (gated by `isEnabled`), so it
  lives inside the enabled branch in Settings.
- The pre-existing "worker process failed to exit gracefully" Jest warning
  is a known teardown artifact (idle timers), not a failure.
- Manual checklist from plan §5 remains for a device pass (not runnable in
  CI): audible speech, jaw movement on the real 3D cat, background-stop,
  restart-voice stability, iOS pod install.
