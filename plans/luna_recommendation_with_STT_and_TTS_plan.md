# Luna Recommendation Integration — With STT & TTS

> Status: **IMPLEMENTED — all phases landed.** Phases 0/0.5/0.6/1/2/3/4 complete. Gates
> green: `tsc --noEmit`, 177 jest tests, eslint no-new-errors on changed files.
> Owner: mobile (React Native / Expo SDK 57)
> Applies to: `/mobile` only. No backend changes, no API contract changes
> (`plans/30-mobile-api-contract.md` untouched).

---

## 0. Critical Pre-Implementation Warning — Ship Order Matters

### 0.1 Phase 0 MUST ship before anything else

Today there are **two independent `useSpeechBubble()` instances**:

- `mobile/src/screens/home/HomeDashboardScreen.tsx:61` — creates its own instance and
  passes `show` into `initEventEngine`, but **never renders** `current`.
- `mobile/src/screens/companion/LunaOverlay.tsx:97` — a separate instance and the
  **only renderer** of the bubble.

Consequence: when EventEngine reacts (`welcome_back`, `day_logged`, …), it updates the
**unrendered** instance — the bubble is effectively invisible (only TTS audio plays).
**Any proactive/reactive bubble feature cannot work until there is exactly one shared
bubble host.**

**Action:** Ship Phase 0 first (single shared bubble instance), run the app, and verify
**one bubble shows regardless of which subsystem triggers it**. Only then proceed to
Phases 1–4.

### 0.2 Verify AIChatScreen reachability before Phase 3

AIChatScreen is **registered** (`navigation/HomeStack.tsx:51`, `types.ts:77`) but has
**no entry point**:
- Not a tab in `MainTabs.tsx` (only Home / Calendar / Analytics / Wellness / Profile).
- Not in Profile's `MENU_ITEMS` (`ProfileHomeScreen.tsx:18`).
- Not navigated from Settings.

So the reactive chat screen is dead code today. Phase 3 (and the Settings row below)
must add a navigation entry before any query path can be exercised.

---

## 1. Objective

Integrate the recommendation engine with Luna so that:

1. **Proactive:** Luna shares "Today's Insight" (motivation or symptom advice) on app
   foreground and after a day save, via speech bubble + optional TTS.
2. **Reactive:** Luna answers explicit text/voice queries ("what's my health tip?") with the
   same card via the AI chat screen. Voice (STT) SHIPPED on `expo-speech-recognition`
   plus **tap-to-speak on the Home overlay** (§8).
3. **Insights toggle:** user can turn off recommendation **cards** in the UI without
   breaking Luna's ability to respond to explicit queries.
4. **Listen & Speak toggle (tap-to-speak):** a separate toggle that shows a **pulsing mic
   halo on Luna's Home overlay**. Tapping it starts a short (≤10 s) one-shot voice
   session — NOT passive/always-on listening. Battery + privacy first (see
   `plans/luna_voice_listen_plan.md`, which replaces the old always-on §8 surface).
   Also used to surface the AI chat entry point from Settings.
5. **App size unchanged:** no offline STT models bundled; no new native dependency in
   this phase.

---

## 1.5 Locked Decisions (from review) — Summary

1. **DayDetailSheet → direct engine call** from the live `obs` draft. Do NOT migrate it
   to the hook. Updated verification item reflects this.
2. **Proactive insight replaces** the generic foreground `welcome_back` and `day_logged`
   bubbles when tier is `motivation`/`recommendation`; falls back to generic otherwise.
   Requires Phase 0 single bubble host first.
3. **Reactive — text + voice** (STT shipped §8 on `expo-speech-recognition`).
4. **STT shipped** — `expo-speech-recognition` (`speechRecognitionService.ts`), no
   `react-native-voice` bare-native dependency.
5. **No `hasLoggedToday` flag** — the pure engine already encodes
   "No Log → Motivation" via existing fallbacks.
6. **`getMotivation()` naming** maps to the real `getMotivationForDay()`
   (`dayInsights.ts:125`) — not needed by the hook (motivation copy comes from
   `MOTIVATION_CARDS` body via the engine).
7. **Listen & Speak = tap-to-speak.** When ON, Luna shows a pulsing mic halo on her Home
   overlay; tapping it starts a short (≤10 s) one-shot voice session. She is NEVER in
   a passive/always-on listening state (privacy: no always-on surveillance; battery: mic
   powers on only for the explicit tap window; UX: Luna is physically rendered on Home
   via `LunaOverlay`, "I look at the cat, I talk to the cat"). Replaces the original
   always-on design (see `plans/luna_voice_listen_plan.md`).
8. **AI chat access.** Since AIChatScreen has no entry point, Settings gains a
   "Chat with Luna" row that navigates to the AI chat screen.

---

## 2. Core Principle — Single Source of Truth

Luna and the recommendation cards consume the **exact same pure functions**:

- `getRecommendationInputFromDay(day, phaseKey)` — `mobile/src/utils/expertRecommendations.ts`
- `getRecommendations(input)` — `mobile/src/utils/expertRecommendations.ts`
- `getSafetyForDay(input).tier` — `mobile/src/utils/symptomSafety.ts`

**No duplication of logic or data.** The tier does **not** come from the recommendation
engine — it comes from the separate safety classifier. The shared hook composes both
with the same input so `card` and `tier` never disagree.

Decision logic (formalized):

| Today's data         | Engine input                              | Result                                   | Tier        |
|----------------------|-------------------------------------------|------------------------------------------|-------------|
| No `CycleDay` (null) | naturally `pain 0`, `no symptoms`         | phase-locked `MOTIVATION_CARDS[phaseKey]`| `motivation`|
| Logged, symptoms OK  | real symptom/pain/severity data           | up to `MAX_CARDS` recommendation cards   | `recommendation` |
| Logged, none         | no symptoms, pain < 2                     | motivation card                          | `motivation`|
| pain ≥ 7             | engine returns `[]`                       | `null` card                              | `seek_care` |

> **Simplication confirmed:** No `hasLoggedToday` flag is added to
> `getRecommendationInputFromDay`. `dayData === null` already yields `pain:0, []`
> through the existing fallbacks (`expertRecommendations.ts:137`, `symptomSafety.ts:140`),
> producing exactly "No Log → Motivation" with zero change to the pure functions.
> The hook's `hasData: boolean` field differentiates the case for consumers.

---

## 3. Architecture

```
User Input (App Open / Save Day / Tap Activity / Toggle)
                          │
                          ▼
            ┌─────────────────────────────┐
            │  useTodayRecommendation()  │   NEW shared hook
            │  (composes the 3 pure fns) │
            └──────────┬─────────────────┘
                       │
        ┌──────────────┼───────────────┐
        ▼              ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Home Banner  │ │ Wellness     │ │  Luna        │
│ (card)       │ │ "For today"  │ │ (proactive + │
└──────────────┘ └──────────────┘ │  reactive)   │
                                  └──────────────┘
                                  (single bubble host)

DayDetailSheet — direct getRecommendations(draft)   (kept — see §6)
```

---

## 4. Phases

### Phase 0 — Unify Bubble Authority (REQUIRED FOUNDATION)

**Problem found:** there are **two independent `useSpeechBubble()` instances**:

- `mobile/src/screens/home/HomeDashboardScreen.tsx:61` — creates its own instance,
  passes `show` into `initEventEngine`, **never renders** `current`.
- `mobile/src/screens/companion/LunaOverlay.tsx:97` — separate instance, the **only**
  renderer (`<SpeechBubble text={speech.text}/>`, line 394).

Today, EventEngine-driven reactions (welcome_back, day_logged) set state on an
*unrendered* host — bubbles are effectively invisible (only TTS audio plays). "Luna's
bubble overrides EventEngine's generic line" **cannot work** until there is exactly one
shared bubble host.

**Change** (`mobile/src/services/companion/EventEngine.ts:124`):

- Convert `useSpeechBubble()` from local `useState` to a **single shared instance**
  (module-level state + `useSyncExternalStore`, or a tiny Zustand store).
- EventEngine `show`, LunaOverlay render, and AIChatScreen all read/write the **same**
  `current`.
- No renderer/layout changes in LunaOverlay.

**Current implementation detail — what must change inside `useSpeechBubble()`:**

The hook today (`EventEngine.ts:124-209`) is built with **local hooks only**:

| Line | Current | Role |
|------|---------|------|
| 125 | `useState<SpeechBubbleEvent \| null>(null)` | per-instance bubble state |
| 126 | `useRef<timeout>(null)` | per-instance auto-dismiss timer |
| 127 | `useRef<string \| null>(null)` | per-instance active TTS id |
| 129-134 | `clearTimer` via `useCallback([])` | cancels the dismiss timer |
| 136-187 | `show(text, animation, durationMs)` via `useCallback` | sets bubble + TTS hold pipeline (speak → only clears on `onDone`/`onStopped`, or `Math.max(durationMs, 15000)` safety) |
| 189-196 | `dismiss()` via `useCallback` | stops TTS + clears |
| 198-206 | `useEffect` cleanup on unmount | per-instance teardown (stops TTS + clears) |

**Conversion contract (must preserve the TTS hold pipeline):**

1. Move `current`, the timeout, and the active-TTS id to **module scope** (single shared
   state).
2. Keep `show`'s TTS hold semantics exactly: when `voiceService.isEnabled()`, the bubble is
   cleared ONLY on `onDone`/`onStopped` OR after `Math.max(durationMs, 15000)`; when TTS is
   disabled, cleared after `durationMs`.
3. `dismiss()` must stop TTS and clear for ALL subscribers.
4. Hook exposes `{ current, show, dismiss }` via `useSyncExternalStore(subscribe, getSnapshot)`
   — same public API, so `HomeDashboardScreen`, `LunaOverlay`, and tests are unaffected.
5. The old per-instance `useEffect` teardown must NOT clear shared state for other listeners;
   replace with a `useSyncExternalStore` `subscribe`-based unsubscription (module-level
   listener set).
6. `initEventEngine(showBubble, ...)` must keep working — `showBubble` is now the shared
   `show`; it can be called from EventEngine **without** any instance.

**Acceptance:** one bubble at a time regardless of which subsystem triggers it.
- EventEngine reaction → bubble renders in LunaOverlay.
- LunaOverlay `showBubble` → same bubble state.
- AIChatScreen future replies → same bubble state.

**Status (DONE — verified):**
- `EventEngine.ts` now holds module-scope `currentBubble` / `bubbleTimeout` / `speechIdRef`
  + a `Set` of `useSyncExternalStore` listeners. `showBubble`, `dismissBubble` are exported
  module functions; `useSpeechBubble()` returns `{ current, show, dismiss }` with the same
  public API (callers unchanged). `initEventEngine` defaults its callback to the shared
  `showBubble` (`show = showBubbleFn ?? showBubble`).
- TTS hold semantics preserved exactly: cleared on `onDone`/`onStopped` OR
  `Math.max(durationMs, 15000)`; `dismiss` stops TTS for all subscribers; the module-level
  timers are nulled on fire so they can't leak across mounts.
- Verification: full companion suite 19 suites / 175 tests pass (`eventFlow.test.ts`,
  `voicePipelineIntegration.test.tsx` cover both subsystems against the one store);
  `tsc --noEmit` clean; on-device dev-client load (Metro 4849 modules) boots to Home
  dashboard with no JS errors.

---

### Phase 0.5 — AI Chat Entry Point (REQUIRED for Phase 3)

**Problem:** `AIChatScreen` is registered (`navigation/HomeStack.tsx:51`; `types.ts:77`)
but unreachable — not a tab, not in `ProfileHomeScreen`'s `MENU_ITEMS`, not linked from
Settings. Dead screen today.

**Change:**
- Add a "Chat with Luna" row in **Settings → Luna section** (`SettingsScreen.tsx`) that
  navigates to the AI chat screen. Since `AIChat` lives in `HomeStackParamList`
  (`types.ts:77`) and Settings runs inside `ProfileStackParamList`, add `AIChat` to the
  Profile stack options OR use a nested navigation call:
  `navigation.navigate('Main', { screen: 'Home', params: { screen: 'AIChat' } })`
  (confirm `Main`/`Home` route names in `MainTabs.tsx` + `RootNavigator.tsx`).
- Optionally add the same "Chat with Luna" row to `ProfileHomeScreen.tsx`'s
  `MENU_ITEMS` (`ProfileHomeScreen.tsx:18`) for a second entry point.
- Keep the tab count at 5 (`MainTabs.tsx`) — do NOT add a 6th tab for chat.

**Acceptance:** `Chat with Luna` in Settings opens the AI chat screen.

---

### Phase 0.6 — "Listen & Speak" Toggle (tap-to-speak)

**Purpose:** A companion toggle to "Show health insights". When ON, Luna's Home overlay
shows a **pulsing mic halo**; tapping it starts a short (≤10 s) one-shot voice session.
This is **tap-to-speak** — she is NOT in a passive/always-on listening state on any
screen.

**Why tap-to-speak (not always-on):**
- **Privacy** — a women's health app passively listening is a red flag; the user must
  explicitly opt into each session by tapping.
- **Battery & performance** — the mic + recognizer run only for the explicit tap window
  (≤10 s), never continuously.
- **UX clarity** — the pulsing halo is a visible, discoverable affordance on the overlay.

**Change** (`mobile/src/stores/companionStore.ts` + `SettingsScreen.tsx`):
- Add `listenAndSpeak: boolean` (default `false`) + `setInsightsPref(partial)` (already
  merged into the shared prefs setter).
- Persist inside `companion_metadata.memory.listen` (JSON — same pattern as
  `memory.speech`), hydrate in `companionStore.hydrate` (line 158), reset in `reset`,
  mirror in `lunaSyncClient` (`lunaSyncClient.ts:321`).
- Settings gets the switch: **🎤 Listen & Speak** [ON/OFF]. Caption:
  "Tap the mic on Luna to talk — no passive listening."

**Behavior matrix (STT shipped; §8):**

| State | Luna Home overlay | AI Chat |
|-------|-------------------|---------|
| ON    | pulsing mic halo → tap = ≤10 s one-shot session → STT → bubble reply (+TTS if enabled). Mic auto-closes. | input-bar mic (unchanged) |
| OFF   | no halo; text-only bubbles | input-bar mic (unchanged) |

**Enforcement (no global singleton):**
- The halo renders only when `listenAndSpeak === true && installStatus === 'ready'`;
  the mic session lives in `useLunaMicSession` (`src/hooks/useLunaMicSession.ts`).
- Permissions requested **at the moment of use** (on first mic tap), never at app start
  or toggle-on (matches frontend rule §2.8).

> **Note:** STT is SHIPPED (§8). This phase ships the **toggle + persistence**
> + **tap-to-speak session hook + mic halo**; the mic handoff uses
> `expo-speech-recognition` directly.

---

### Phase 1 — Shared Hook `useTodayRecommendation`

**NEW** `mobile/src/hooks/useTodayRecommendation.ts`:

```ts
interface TodayRecommendation {
  card: RecommendationCard | null;   // first card from engine (null on seek_care/no data→motivation is a card)
  tier: 'seek_care' | 'recommendation' | 'maintenance' | 'motivation';
  phaseKey: PhaseRange['key'];
  painLevel: number;
  hasData: boolean;                  // whether today's CycleDay exists
  isLoading: boolean;
}

function useTodayRecommendation(): TodayRecommendation {
  const dayData = useTodayDayData();                 // existing
  const { phaseKey } = useCurrentCycleState();       // existing
  // 1. Build input via getRecommendationInputFromDay(dayData, phaseKey)
  // 2. card = getRecommendations(input)[0] ?? null
  // 3. tier = getSafetyForDay(input).tier
  // 4. Refresh on 'day_logged' eventBus emit (see §5.1)
  // return { card, tier, phaseKey, painLevel, hasData: !!dayData, isLoading }
}
```

**Consumers migrated:**
- `mobile/src/components/home/HomeRecommendationBanner.tsx:33` — replace inline engine
  call with the hook (keep its existing step-through card display).
- `mobile/src/components/ui/wellness/DynamicRecommendations.tsx:38` — "For today"
  block uses the hook. **Non-engine** Wellness cards (data-quality, mood-gap, API health
  tips) stay as they are (toggle scoping, see §7).
- **DayDetailSheet KEEPS the direct call** (`DayDetailSheet.tsx:272`) — it computes
  from the **live editor draft** (`obs` state), not from today's *saved* `CycleDay`.
  Swapping to the hook would break the live symptom-toggle preview. SSOT is preserved
  because it calls the same `getRecommendations(input)` pure function.

**Verification item (updated):**
> Home Banner + Wellness "For today" use `useTodayRecommendation`; **DayDetailSheet
> uses the direct engine call from the editor draft.**

#### 5.1 Staleness fix — "After save" proactive must be fresh

`useTodayDayData` (`hooks/useTodayDayData.ts`) is a plain `useState` fetch keyed on
`userId` — it never refetches, so after a save it returns stale/null data.

**Fix:** inside `useTodayRecommendation`, subscribe to the existing `day_logged`
eventBus emit (`mobile/src/services/queries/cycle.ts:478`, fired on
`useUpsertDay` success, after `upsertCycleDay` already updated localDb) and re-fetch
from `localDb.cycleDay`. No separate `lastSavedDate` store needed.

---

### Phase 2 — Luna Proactive (on foreground / after save)

- Extend `initEventEngine` (`services/companion/EventEngine.ts:211`) with an injected
  getter (same injection pattern as `dialogueEngine.setCyclePhaseSource`):

  ```ts
  initEventEngine(showBubble, popup, { getTodayInsight: () => TodayRecommendation })
  ```

- In the existing `app_foregrounded` (line 303) and `day_logged` (line 109/287)
  handlers:
  - If `insight.card && insight.tier ∈ {motivation, recommendation}` → `showBubble(
    card.title, animation)` instead of the generic welcome-back / day_logged line.
  - Else fall back to the current generic bubble.
- **Safety guard:** never proactive when `tier === 'seek_care'` (engine already
  returns `[]` → card null → falls back). Reserved for DayDetailSheet.
- **Animation mapping:** `motivation` → `happy`; `recommendation` → `idle` (gentle).
- **Gate:** skip when `showInsights === false` or `isHidden`.

**Why it works now:** Phase 0 unifies the bubble host, so "override" is one `show`
call that replaces whatever generic bubble was queued.

---

### Phase 3 — Luna Reactive (text-only first, STT SHIPPED)

**Scope decision:** text-only first. STT landed later on `expo-speech-recognition` —
a first-party SDK-57-compatible module (see §8) — doing the mic dialog instead of the
system dictation fallback.

**Prerequisite — entry point:** run Phase 0.5 (Settings "Chat with Luna" row) first;
`AIChatScreen` is registered (`navigation/HomeStack.tsx:51`) but currently **unreachable**
— Phase 0.5 makes it navigable.

**Location:** `mobile/src/screens/chat/AIChatScreen.tsx` (LunaChat.tsx does **not**
exist — confirmed).

- **Text query path:** add a keyword branch (`health`, `tip`, `today`, `period`,
  `cramps`, `energy`, `mood`, `sleep`) in `simulateAIResponse` (`AIChatScreen.tsx:242`)
  → resolve via `useTodayRecommendation()` → reply with `card.title` / `card.body`.
  This path **ignores** the `showInsights` toggle (explicit ask always works), and
  works regardless of the toggle state.
- **Mic button** (`AIChatScreen.tsx:192`): real STT (SHIPPED §8) — press to listen,
  interim/final results stream into the input and auto-send; recording state colors the
  input + mic; permission requested at the moment of use.
- **Listen & Speak interplay:** Phase 0.6's `listenAndSpeak` shows the tap-to-speak mic
  halo on Luna's Home overlay (STT shipped, §8) which uses the same `showBubble`-based
  reply path shown above.

---

### Phase 4 — Settings Toggles: "Show Health Insights" + "Listen & Speak"

**Store** (`mobile/src/stores/companionStore.ts`):
- Add `showInsights: boolean` (default `true`) + `setInsightsPref(partial)`.
- Add `listenAndSpeak: boolean` (default `false`) + `setListenAndSpeakPref(partial)`.
- Persist both inside `companion_metadata.memory` JSON (`memory.insights`,
  `memory.listen` — same pattern as `memory.speech`), hydrate in
  `companionStore.hydrate` (line 158), reset in `reset`.
- Mirror in `lunaSyncClient`'s memory mapping (`lunaSyncClient.ts:321`) so both flags
  survive sync round-trips.

**Settings UI** (`mobile/src/screens/profile/SettingsScreen.tsx`, Luna section):
- Add switch: `💡 Show health insights` [ON/OFF].
- Add switch: `🎤 Listen & Speak` [ON/OFF] with caption
  "Active on the Home screen only. Other screens use Tap to Speak."
- Add row: `💬 Chat with Luna` → opens AIChatScreen (Phase 0.5).

**Gating (Show health insights):**

| Toggle        | UI Cards (banner, Wellness "For today") | Luna Proactive | Luna Reactive |
|---------------|------------------------------------------|----------------|---------------|
| ON (default)  | shown                                    | on             | on            |
| OFF           | hidden                                   | never          | **still on** (explicit query) |

**Gating (Listen & Speak):** shows the tap-to-speak mic halo per the Phase 0.6 behavior
matrix; all mic sessions are button-initiated.

---

## 5. Files — Create / Modify

| File | Action | Change |
|------|--------|--------|
| `mobile/src/hooks/useTodayRecommendation.ts` | **NEW** | Shared hook composing `useTodayDayData` + `useCurrentCycleState` + `getRecommendations` + `getSafetyForDay`; subscribes to `day_logged` for refresh. |
| `mobile/src/services/companion/EventEngine.ts` | MODIFY | Single bubble host (Phase 0); `initEventEngine` gains `getTodayInsight`; proactive override in `app_foregrounded` + `day_logged`. |
| `mobile/src/screens/companion/LunaOverlay.tsx` | MODIFY | Reads the shared bubble host; adds the tap-to-speak mic halo (`LunaMicButton`) + `useLunaMicSession`. |
| `mobile/src/hooks/useLunaMicSession.ts` | **NEW** | Tap-to-speak session engine (one-shot, TTS guard, 10 s auto-stop, keyword reply path). |
| `mobile/src/hooks/useHomeAlwaysListening.ts` | **DELETE** | Replaced by `useLunaMicSession`; passive listening removed. |
| `mobile/src/hooks/useShouldListen.ts` | **DELETE** | Dead after always-on removal. |
| `mobile/src/screens/home/HomeDashboardScreen.tsx` | MODIFY | Pass `getTodayInsight` into `initEventEngine`. |
| `mobile/src/components/home/HomeRecommendationBanner.tsx` | MODIFY | Use shared hook. |
| `mobile/src/components/ui/wellness/DynamicRecommendations.tsx` | MODIFY | "For today" block uses shared hook. |
| `mobile/src/screens/chat/AIChatScreen.tsx` | MODIFY | Keyword branch → recommendation reply; mic button does real STT (SHIPPED). |
| `mobile/src/stores/companionStore.ts` | MODIFY | `showInsights` + `setInsightsPref` + `listenAndSpeak` + `setInsightsPref`, hydrate/persist/reset. |
| `mobile/src/services/companion/lunaSyncClient.ts` | MODIFY | Map `memory.insights` + `memory.listen` in sync payload. |
| `mobile/src/screens/profile/SettingsScreen.tsx` | MODIFY | "Show health insights" switch + "Listen & Speak" switch + "Chat with Luna" row. |
| `mobile/src/navigation/HomeStack.tsx` / `types.ts` | VERIFY | `AIChat` already registered; confirm nested navigation params for Settings → chat. |
| `mobile/src/screens/profile/ProfileHomeScreen.tsx` | MODIFY (optional) | Optional "Chat with Luna" row in `MENU_ITEMS`. |
| `mobile/src/components/ui/DayDetailSheet.tsx` | **NO CHANGE** | Stays on direct `getRecommendations(input)` from editor draft. |

---

## 6. Decisions locked in (from review)

1. **DayDetailSheet → direct engine call** from the live `obs` draft. Do NOT migrate it
   to the hook. Updated verification item reflects this.
2. **Proactive insight replaces** the generic foreground `welcome_back` and `day_logged`
   bubbles when tier is `motivation`/`recommendation`. Falls back to generic otherwise.
   Requires Phase 0 single bubble host first.
3. **Reactive — text + voice** (STT shipped §8 on `expo-speech-recognition`).
4. **STT shipped** — `expo-speech-recognition` (`speechRecognitionService.ts`), no
   `react-native-voice` bare-native dependency.
5. **No `hasLoggedToday` flag** — the pure engine already encodes
   "No Log → Motivation" via existing fallbacks.
6. **`getMotivation()` naming** in the original suggestion maps to the real
   `getMotivationForDay()` (`dayInsights.ts:125`) — not needed by the hook (motivation
   copy comes from `MOTIVATION_CARDS` body via the engine).
7. **Listen & Speak is Home-screen-only** — active only when `listenAndSpeak === true &&
   focusedRoute === 'Home'`; all other screens = tap-to-speak (privacy/battery/UX).
8. **AI chat access** — Settings gains a "Chat with Luna" row (Phase 0.5); tab count
   stays at 5.

---

## 7. Toggle scoping notes (decisions required before impl)

**7a. Show health insights (OFF):** hides the **engine-driven** cards (Home banner +
Wellness "For today" block) and stops Luna proactive. Non-engine Wellness
recommendation rows — data-quality nudge, mood-gap nudge, API health tips (see
`DynamicRecommendations.tsx:48-111`) — are **left visible** in this plan. If the intent
is "hide the entire Wellness recommendation list", the conditional must also cover the
`recommendations()` output as a whole. *(Default this plan: engine-only scoping.)*

**7b. Listen & Speak (ON):** shows the pulsing mic halo on the Home overlay. Tapping it
runs a short, one-shot tap-to-speak session (`useLunaMicSession`). There is NO
always-on/passive listening on any screen. Mic handoff is **shipped** (§8): the halo
uses `expo-speech-recognition` directly; the session auto-closes after a final
transcript, silence, error, or a 10 s safety timeout.

---

## 8. STT / TTS — App size preserved

- **TTS:** already shipped — `expo-speech` (`voiceService.ts`) with deterministic
  voice resolution. Used by all `showBubble` calls when enabled.
- **STT:** **SHIPPED** — `expo-speech-recognition` (`speechRecognitionService.ts`),
  a first-party Expo module that plugins into prebuild cleanly. iOS
  `SFSpeechRecognizer`, Android `SpeechRecognizer`, Web `SpeechRecognition`; New
  Architecture supported; config plugin adds Android package-visibility filters
  + permissions (`RECORD_AUDIO` / `NSMicrophoneUsageDescription` were already in
  `app.json`). Confirmed SDK-57 build-compatible (published as 56.0.1; no
  SDK-57-tagged release exists, `npx expo install` resolves it).
- **Surface:**
  - `src/services/companion/speechRecognitionService.ts` — subscription API
    mirroring `voiceService` (`onTranscript` / `onListeningChange` / `onError`,
    `start` / `stop` / `abort`, `isAvailable`, `requestPermissions`). Events are
    bridged from the native module exactly once (`bindNative`). One-shot by default.
  - `src/hooks/useSpeechRecognition.ts` — React binding with
    `isListening` / `lastTranscript` / `error` and `start` (requests permission
    at the moment of use — never at app start) / `stop` / `abort`.
  - `src/hooks/useLunaMicSession.ts` — **tap-to-speak session engine** (replaces the
    old always-on `useHomeAlwaysListening`). One-shot `continuous: false` sessions
    driven by the mic halo on Luna's overlay; `voiceService.stop()` before starting so
    Luna's own TTS is never transcribed; 10 s safety auto-stop; final transcripts fed
    through the SHARED keyword path (`matchesInsightKeyword` + `buildInsightReply` in
    `src/utils/lunaReply.ts`) then `showBubble`. Locked fallbacks: no-keyword →
    "I heard you 💕…"; silence → "I didn't catch that — tap the mic and try again."
  - `LunaOverlay.tsx` — pulsing mic halo (`LunaMicButton`, idle pulse / listening ring /
    processing spinner, honors `useReducedMotion`), rendered when
    `listenAndSpeak && installStatus === 'ready'`.
  - `AIChatScreen.tsx` mic button — replaced `inputRef.current?.focus()` (system
    dictation) with real STT; interim/final results auto-send into the chat,
    listening state colors the input + mic, STT errors surface as a banner.
- **When STT lands keeps working:** the Home tap-to-speak halo (Phase 0.6
  `listenAndSpeak` state) routes speech → the same keyword path as the text branch
  (Phase 3). Mic on AIChatScreen does real STT instead of dictation-keyboard fallback.
- **Always-on is REMOVED:** `useHomeAlwaysListening.ts` and `useShouldListen.ts` no
  longer exist — passive/continuous mic is gone everywhere. See
  `plans/luna_voice_listen_plan.md`.

---

## 9. Verification Checklist

- [x] **Phase 0 first:** one bubble host — a single bubble shows regardless of trigger
      source (welcome_back, day_logged, proactive insight).
- [x] **Phase 0 internals:** `useSpeechBubble` shared store keeps the TTS hold pipeline
      (`onDone`/`onStopped` or `Math.max(durationMs, 15000)`); `dismiss` stops TTS for all
      subscribers; old per-instance teardown does not clear shared state.
- [x] **Phase 0.5:** "Chat with Luna" in Settings opens AIChatScreen; tab count unchanged.
- [x] `useTodayRecommendation()` returns the **same card** as the banner/Wellness
      inline engine calls (snapshot/unit test).
- [x] Home banner + Wellness "For today" use the hook; **DayDetailSheet uses the direct
      engine call from the draft**.
- [x] No-log day ⇒ motivation card, tier `motivation` (no `hasLoggedToday` flag shipped).
- [x] Proactive insight appears on app open and after day save, replacing the generic
      bubble; animation matches tier (happy / idle).
- [x] Luna does **NOT** proactively show `seek_care` (pain ≥ 7 / red-flag) insights.
- [x] Typed query "what's my health tip?" in AIChatScreen returns the same card; works
      with toggle OFF.
- [x] Show-insights OFF: banner + Wellness "For today" hidden; Luna proactive stops;
      Luna reactive still responds.
- [x] Listen & Speak: pref persists; mic halo shows on the Home overlay when ON; tapping
      it starts a one-shot session; no mic permission at app start (permissions at moment
      of use); halo hidden when OFF / not installed. No passive/always-on listening
      anywhere (`useHomeAlwaysListening` / `useShouldListen` deleted).
- [x] `npx tsc --noEmit` green; ESLint on changed files has **no new** errors (only
      pre-existing inline-style debt in AIChatScreen/SettingsScreen at unchanged lines).
- [x] Jest green: `companion`, `expertRecommendations`, `DynamicRecommendations`,
      `useCurrentCycleState`, plus new `useTodayRecommendation` consumers (177 tests).
- [x] **STT shipped:** `speechRecognitionService` + `useSpeechRecognition` +
      `useLunaMicSession` (tap-to-speak) + AIChat mic wiring; `expo-speech-recognition`
      jest mock in `jest.setup.js`; unit tests (`speechRecognitionService.test.ts`,
      `lunaReply.test.ts`, `useLunaMicSession.test.ts`) green.
- [x] No new native dependencies; app size unchanged.
- [x] `plans/30-mobile-api-contract.md` unchanged (no request/response shape change).

---

## 10. Out of scope (future)

- Luna text chat screen (does not exist); if added later, route through the same
  shared hook.
- Backend feature-flag / A/B for recommendations.
- `getInsightForDay` legacy helper consolidation.