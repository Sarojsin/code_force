# Luna Voice Guide — TTS (Luna speaks) + STT (You speak to Luna)

Complete working guide for Luna's two-way voice. **TTS** ships on `expo-speech`;
**STT** ships on `expo-speech-recognition`. This guide covers the settings, the exact
phrases that get a response, how each path activates, and the wiring beneath it.

Checklist alignment: `AGENTS.md` §2.8 (permissions at moment of use, never app start),
§7b Listen & Speak (tap-to-speak mic halo), `plans/luna_voice_listen_plan.md`, and
`plans/luna_recommendation_with_STT_and_TTS_plan.md` §8.

---

## 1. The two directions at a glance

| Direction | What it does | Toggle needed | Activation point | Native engine |
|-----------|--------------|---------------|------------------|---------------|
| **TTS — Luna speaks** | Luna reads dialogue/bubbles aloud with a device voice | `Luna Speaks` (default **OFF**) | Every `showBubble()` call | `expo-speech` |
| **STT — you speak to Luna** | Luna transcribes your voice into a chat message or a Home bubble reply | `Listen & Speak` for the Home mic halo (default **OFF**) | Chat mic button (any screen) OR the tap-to-speak halo on the Home overlay | `expo-speech-recognition` |

Both are user-opt-in. Nothing requests a permission or opens the microphone at app
start — **permission is always requested at the moment of use** (first mic tap).

---

## 2. The four settings involved (Settings → Luna section)

Exact rows on `SettingsScreen.tsx`:

1. **`Luna Speaks`** (`speakEnabled`, default OFF) — description: *"Read dialogue aloud
   (device voice)"*. Master gate for TTS.
2. **`Mute Sounds`** (`muteSounds`) — *"Disable meows and purrs"*. When ON it also
   quiets Luna speaking (TTS checks `speakEnabled && !muteSounds`).
3. **`Listen & Speak`** (`listenAndSpeak`, default OFF) — *"Tap the mic on Luna to talk
   — no passive listening."* Shows the pulsing mic halo on Luna's Home overlay; tapping
   it starts a short, one-shot voice session.
4. **`Show Health Insights`** (`showInsights`, default ON) — controls **proactive**
   insight cards/bubbles, not reactive replies (an explicit query always answers).

> 💡 To use voice end-to-end on Home: turn **both** `Luna Speaks` and `Listen & Speak`
> **ON**; then tap the mic halo that appears on Luna. To only talk in the chat: turn on
> `Luna Speaks` (optional) — the chat mic works regardless of the toggles.

---

## 3. TTS — how Luna speaking activates (works today)

### Activation logic

```ts
// voiceService.ts
isEnabled(): boolean {
  const state = useCompanionStore.getState();
  return state.speakEnabled && !state.muteSounds;
}
```

TTS activates from **every** `showBubble()` in `EventEngine.ts`:

- When `showBubble(text, animation, durationMs)` runs and `voiceService.isEnabled()`
  is true, Luna calls `Speech.speak(text, …)`.
- The bubble is **held on screen** until speech finishes (or a 15 s cap), then clears.
- If TTS is disabled/muted, the bubble just shows for `durationMs` (no voice).
- Stopping conversations (`dismissBubble`, a new bubble, screen blur) stops speech.

### Where bubbles come from (the same events that can be spoken)

- Welcome-back / app foreground (`app_foregrounded`)
- `day_logged`, `period_logged`, `period_corrected`, `mood_logged`
- Habit events: `water_logged`, `food_logged`, `exercise_completed`, `sleep_logged`,
  `medication_logged`
- Diary: `diary_opened`, `diary_page_created`, `diary_page_saved`, `diary_photo_added`,
  `diary_media_synced`
- Proactive Today's Insight (Luna plan Phase 2) when `showInsights` ON and tier is
  `motivation`/`recommendation`
- Reactive replies (STT, chat) — see §4/§5

### Voice selection (deterministic)

`resolveVoice()` (`voiceService.ts:35`) ranks installed voices: `enhanced` quality
first, then a female-name heuristic, lowest index wins for cross-session stability.
Resolved once on first enable, persisted in `companion_metadata.memory.speech`
(`speechVoiceId`), reused across sessions; re-resolves only if the persisted id
vanishes.

### Enable/disable

- Toggling **ON** resolves + persists the voice id.
- Toggling **OFF** (or mute) immediately `stop()`s any speech in progress.

---

## 4. STT — entry point 1: Chat mic button (Tap to Speak, any screen)

`AIChatScreen` — `ChatInputBar` mic button (`AIChatScreen.tsx:128+`).

### Flow

1. **Tap the mic** → `useSpeechRecognition().start()`:
   - checks `isRecognitionAvailable()`
   - requests mic permission **at the moment of use**; if denied, shows a banner
     ("Microphone permission is required to talk to Luna.")
   - starts **one-shot** recognition (`continuous: false`, `interimResults: true`,
     `lang: en-US`)
2. While listening: input border turns green, placeholder becomes **"Listening…"**,
   tap again to stop (`stop()`).
3. **Final transcript** is **auto-sent** into the chat — it becomes a user message and
   goes through the exact same `handleSend → simulateAIResponse` path as typed text.
4. Interim results update as you speak; errors (no-speech, not-allowed, network)
   surface as a banner under the input bar.

> The old behavior (mic = focus TextInput / system dictation keyboard) was replaced.

---

## 5. STT — entry point 2: Tap-to-speak halo on Luna (Listen & Speak)

When `Listen & Speak` is ON and Luna is installed (`installStatus === 'ready'`), a
**pulsing mic halo** appears beside Luna's head on the Home overlay (`LunaOverlay.tsx`).
There is **no passive/always-on listening on any screen** — the mic powers on only for
an explicit, ≤10 s one-shot session started by tapping the halo.

### Activation gate (luna_voice_listen_plan §5.5)

```ts
// LunaOverlay.tsx — halo renders only when:
listenAndSpeak === true && installStatus === 'ready' && !expanded
```

Tap → `useLunaMicSession(card).start()`:

```ts
// useLunaMicSession.ts
voiceService.stop();                               // never transcribe Luna's own TTS
speechRecognitionService.start({ continuous: false });  // one-shot
// safety: 10 s setTimeout → abort() + no-speech bubble
```

### Sanity-check rules (locked)

1. **TTS guard:** `voiceService.stop()` runs before the recognizer starts and when the
   session ends — Luna's spoken reply is never transcribed.
2. **Overlapping sessions:** a tap while listening stops the session (toggle-off); a tap
   while processing is ignored.
3. **Reduced motion:** the halo shows the pulse loop only when
   `useReducedMotion()`/`reduceAnimations` are off; otherwise it is a static icon.

### Flow

1. **Tap the halo** → permission requested at the moment of use (first tap only).
2. **One-shot recognition** (`continuous: false`, `interimResults: true`) records for up
   to 10 s, auto-closing on a final transcript, silence, an error, or the timeout.
3. Every **final** transcript is routed through the **same keyword path as the chat
   text branch** (`src/utils/lunaReply.ts`):
   - `matchesInsightKeyword(text)` → any of `health`, `tip`, `today`, `period`,
     `cramps`, `energy`, `mood`, `sleep` (case-insensitive, substring)
   - If a keyword hit **and** there's a today's-cards card (`useTodayRecommendation` via
     the `recommendationCard` prop): Luna shows a bubble with the **card**:
     `"Title: body [cta]"`, animation `happy`, 5 s.
   - If a keyword hit but no card today — or **no keyword** at all: **"I heard you 💕
     Ask me about your period, mood, sleep, or today's tip!"**, `idle`, 3 s.
   - Silence / no speech: **"I didn't catch that — tap the mic and try again."**, `idle`,
     3 s.
4. The halo returns to its **idle pulse**; the mic is fully closed (not listening) until
   the next tap.

> The old always-on design (`useHomeAlwaysListening` + `useShouldListen`) is deleted —
> the microphone is never left open or streaming in the background.

---

## 6. What to say to get a cycle-aware response

Because replies resolve via the shared keyword/engine path, these classes of phrases
work identically in the chat (typed or spoken) and on Home (spoken).

### ✅ Keyword branch — returns today's real recommendation card

Say a phrase containing **any** of: `health`, `tip`, `today`, `period`, `cramps`,
`energy`, `mood`, `sleep`.

| Semantics | Example phrases (voice or type) |
|-----------|--------------------------------|
| Today's insight | "what's my health tip today?", "tell me today's tip" |
| Period | "tell me about my period", "period advice" |
| Cramps/pain | "I have cramps", "help with cramps" |
| Energy | "why am I so tired", "energy today" |
| Mood | "my mood", "I feel low today" |
| Sleep | "sleep tips", "help me sleep" |

The reply body = the recommendation engine's card for **today** (driven by cycle
phase + logged symptoms + pain). This branch **ignores** the `Show Health Insights`
toggle — an explicit ask always answers.

> ⚠️ If it's a **no-log day**, the engine returns a **motivation** card — you still get
> an encouraging reply rather than nothing.

### ✅ Chat-only phrase table (exact-match, typed or spoken)

| Your phrase | Luna replies with |
|-------------|-------------------|
| "Track my period" | Guide to the Calendar tab |
| "Log a symptom" | Symptom list + Calendar pointer |
| "Cycle education" | 4-phase cycle explainer |
| "Feeling anxious" | Calming tips + breathing offer |

### ⚠️ Anything else

- **Chat:** generic supportive fallback + medical disclaimer.
- **Home (tap-to-speak):** "I heard you 💕 Ask me about your period, mood, sleep,
  or today's tip!" bubble.

---

## 7. Permission & privacy rules (must hold)

- Mic permission is requested **at the moment of use**, never at app start
  (`useSpeechRecognition.start()` → `requestPermissionsAsync()`).
- Manifest entitlements already declared in `app.json`:
  - Android `RECORD_AUDIO` (plus config-plugin package-visibility for
    `com.google.android.googlequicksearchbox`)
  - iOS `NSMicrophoneUsageDescription`
- The STT config plugin adds the Android speech-service package-visibility filter.
- STT transcripts are only used to produce the chat message / bubble reply — nothing
  is logged to console (no PII; transcript is user-visible intent only).

---

## 8. Architecture & files

### New STT surface

| File | Role |
|------|------|
| `src/services/companion/speechRecognitionService.ts` | Subscription-wrapper over `ExpoSpeechRecognitionModule` mirroring `voiceService`: `start/stop/abort`, `isAvailable`, `requestPermissions`, `onTranscript/onListeningChange/onError`, one-shot vs `continuous`. Native event bridge bound once (`bindNative`). |
| `src/hooks/useSpeechRecognition.ts` | React binding: `isListening`, `isAvailable`, `lastTranscript`, `error`, `start` (requests permission), `stop`, `abort`; optional `onResult` callback. |
| `src/hooks/useLunaMicSession.ts` | **Tap-to-speak** session engine (replaces the always-on hook): one-shot sessions, TTS guard, ≤10 s auto-stop, keyword reply → `showBubble`. |
| `src/utils/lunaReply.ts` | Shared keyword branch: `INSIGHT_KEYWORDS`, `matchesInsightKeyword`, `buildInsightReply`, `buildInsightReplyWithDisclaimer` — used by **both** chat and Home so voice/typed replies never diverge. |

### Existing TTS surface (unchanged)

| File | Role |
|------|------|
| `src/services/companion/voiceService.ts` | TTS: `speak/stop`, `isEnabled`, deterministic `resolveVoice` + persisted voice id, `onSpeaking` events. |
| `src/services/companion/EventEngine.ts` | `showBubble` — speaks every bubble when TTS enabled; holds bubble while speaking. |
| `src/screens/companion/LunaOverlay.tsx` | Renders the bubble; subscribes to `voiceService.onSpeaking` to drive Luna's talking animation. |

### Changed by this feature

- `package.json` / `app.json` — added `expo-speech-recognition` + config plugin.
- `AIChatScreen.tsx` — mic now runs real STT (was dictation-keyboard shortcut).
- `LunaOverlay.tsx` — tap-to-speak mic halo (`LunaMicButton`) + `useLunaMicSession`.
- `HomeDashboardScreen.tsx` — passes `recommendationCard` into `LunaOverlay`; no longer
  mounts `<HomeAlwaysListening />`.
- `jest.setup.js` — `expo-speech-recognition` mock (fire events via
  `ExpoSpeechRecognitionModule.__fireEvent`, assert `start/stop/abort/permissions`).
- **Deleted:** `useHomeAlwaysListening.ts`, `useShouldListen.ts` (passive mic removed).

---

## 9. Build & device notes

- STT is a **native module** — requires a dev-client rebuild:
  `npx expo run:android` (or `npx expo prebuild --platform android` then Gradle).
  The library is New-Architecture compatible; `libjsi` ships in the APK and the
  source-built module links cleanly (AGENTS §6 pipeline).
- Addressable recognition is **one-shot** per utterance (tap-to-speak halo and chat mic
  both use `continuous: false`).
- `lang: "en-US"` default. All keywords/en-US phrases assume English.
- After `npm ci`, patches re-apply automatically via `postinstall: patch-package`
  (AGENTS §6.3).

---

## 10. Fast reference — "I just want it to work"

1. Rebuild once: `npx expo run:android`.
2. Settings → Luna → turn **ON** `Luna Speaks` (hear Luna) and turn **ON**
   `Listen & Speak` (shows the mic halo on Home).
3. **Tap the mic halo on Luna** (Home screen) and say *"what's my health tip today?"* —
   or open **Chat → Chat with Luna** and tap the **mic** to speak. Luna's bubble shows
   — and if `Luna Speaks` is ON, she reads it aloud.
4. The mic closes automatically after your sentence (or ~10 s of silence); no background
   listening.
5. Mic permission is requested the first time you tap — grant it. Denying shows a
   friendly in-app banner; re-enable under system Settings > SheCare.