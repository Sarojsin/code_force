# Luna Voice Listen Plan — Tap-to-Speak (scrap always-on listening)

> Companion to `plans/luna_recommendation_with_STT_and_TTS_plan.md`.
> This plan REPLACES the "Home always-on listening" surface described in that
> plan (Phase 7b) with a battery-first, permission-minimal **tap-to-speak**
> interaction. Once approved, this document is the source of truth for the
> refactor; the main plan is updated in the same PR.

Status: **DRAFT — awaiting review**

---

## 1. Problem

The current implementation (`useHomeAlwaysListening.ts`) keeps the microphone
in **continuous recognition** whenever the "Listen & Speak" toggle is ON and the
Home dashboard is focused. This has real costs:

- **Battery drain** — the mic + recognition engine run indefinitely.
- **Persistent OS "Microphone Active" indicator** — Android mic dot / iOS orange
  dot stay visible while the toggle is ON, which reads as surveillance.
- **Privacy optics** — a women's health app passively listening is a red flag.
- **Feedback risk** — requires a pause/resume dance with TTS (`voiceService`
  `onSpeaking`) to stop the recognizer transcribing Luna's own replies.

All of this buys a "wake-word-free hands-free" UX that the user does not want.

## 2. Locked decisions (verified with user)

| # | Decision |
|---|----------|
| 1 | **Scrap always-on listening entirely.** No passive mic anywhere, ever. |
| 2 | **Mic icon on BOTH surfaces, user-controlled on/off.** Home gets a pulsing mic halo on Luna's overlay; AI Chat keeps its input-bar mic button. Tapping starts a short listen session; tapping again stops it early. |
| 3 | **Battery is the priority.** Mic powers on only for an explicit, short session. |
| 4 | **No-keyword fallback** → gentle bubble: "I heard you 💕 Ask me about your period, mood, sleep, or today's tip!" |
| 5 | **Listen window** → 10 s auto-stop safety timeout (auto-closes sooner on final/end). |
| 6 | **Delete dead hooks** `useShouldListen.ts` and `useHomeAlwaysListening.ts`. |
| 7 | **Chat mic stays always-available** (button-initiated), regardless of toggle. |
| 8 | **No native rebuild needed** — all changes are JS/TS; STT native module already shipped and verified. |

## 3. Behavior matrix (after refactor)

| Surface | "Listen & Speak" OFF (default) | "Listen & Speak" ON |
|---|---|---|
| **Home (Luna overlay)** | No mic icon. Text-only bubbles. | Pulsing mic halo beside Luna → tap = 10 s one-shot listen → STT → bubble reply (+TTS if "Luna Speaks" ON) → auto-close. Tap-again stops early. |
| **AI Chat** | Input-bar mic button works (unchanged, button-initiated). | Same input-bar mic (unchanged). |
| **Mic state** | Off. | Off between taps. On only during the explicit tap session. |

**Permission:** requested at FIRST TAP only (never at toggle-on / app start).

## 4. File change list

### 4.1 Deletions (dead code)

| File | Why |
|---|---|
| `mobile/src/hooks/useHomeAlwaysListening.ts` | Continuous listening hook + `HomeAlwaysListening` mount-point — no longer used. |
| `mobile/src/hooks/useShouldListen.ts` | Gate `listenAndSpeak === true && isHomeFocused` — no consumers after refactor. |

### 4.2 Edits

| File | Change |
|---|---|
| `mobile/src/screens/home/HomeDashboardScreen.tsx` | Remove `HomeAlwaysListening` import (line 28) and `{lunaEnabled && <HomeAlwaysListening />}` mount (line 397). |
| `mobile/src/screens/companion/LunaOverlay.tsx` | Add `LunaMicButton` halo (idle pulse / listening ring / processing spinner), tap handler wiring to `useLunaMicSession`, `useReducedMotion` support, a11y labels, ≥44 pt touch target. |
| `mobile/src/screens/profile/SettingsScreen.tsx` | Caption (line 389) → "Tap the mic on Luna to talk — no passive listening." Handler unchanged. |
| `plans/luna_recommendation_with_STT_and_TTS_plan.md` | Update Phase 7b / §8 surface list, header summary, verification checklist: replace always-on wording with tap-to-speak. |
| `mobile/luna_guide.md` | Update §1/§2/§5/§8/§10 to describe tap-to-speak instead of Home always-on. |

### 4.3 New files

| File | Purpose |
|---|---|
| `mobile/src/hooks/useLunaMicSession.ts` | Tap-to-speak session engine (see §5). |
| `mobile/src/hooks/__tests__/useLunaMicSession.test.ts` | Jest coverage via existing `expo-speech-recognition` mock (see §7). |

## 5. `useLunaMicSession` API (new hook)

```
useLunaMicSession(card): {
  isListening: boolean;
  isProcessing: boolean;
  start: () => Promise<void>;   // tap-to-speak session
  stop:  () => void;            // early stop (tap-again / user cancel)
}
```

Behavior:
1. `start()`:
   - If already listening → `stop()` (toggle-off semantics).
   - `voiceService.stop()` first (never transcribe Luna's own TTS).
   - Request permission at first tap (via `useSpeechRecognition.start`).
   - One-shot STT: `start({ continuous: false })` on `speechRecognitionService`.
   - Arm a **10 s `setTimeout`** safety auto-stop → `abort()` + mark no-speech.
2. On `final` transcript:
   - Trim + lowercase; `matchesInsightKeyword(text)` → `buildInsightReply(card)`
     → `showBubble(reply, 'happy', 5000)`.
   - No keyword → gentle fallback bubble (locked decision #4).
3. On `end` before any final (no-speech / silence):
   - If a reply was already shown, just close the mic.
   - Else → "I didn't catch that — tap the mic and try again." bubble + close.
4. On `error`: `abort()`, close mic, no crash. (Non-critical → optional toast.)
5. `isProcessing` true while awaiting a final transcript; false once reply shown.
6. Cleanup on unmount: clear timer + `abort()`.

**Reuses (no rework):** `speechRecognitionService`, `useSpeechRecognition`,
`lunaReply` keyword path, `EventEngine.showBubble`, `voiceService`.

## 5.5 Sanity checks (locked)

| # | Check | Behavior |
|---|-------|----------|
| 1 | **TTS guard (critical)** | `start()` MUST call `voiceService.stop()` BEFORE `speechRecognitionService.start(...)`. Luna's own spoken replies are never transcribed. |
| 2 | **No-keyword fallback copy (locked)** | Exactly: `"I heard you 💕 Ask me about your period, mood, sleep, or today's tip!"` — do NOT change without re-approval. |
| 3 | **Reduced motion** | Pulsing glow must honor `useReducedMotion`: static icon (no pulse) or very gentle opacity change when reduced motion is enabled. |
| 4 | **Overlapping sessions** | Only ONE session active at a time. Tap while listening → stop (toggle-off). Tap while processing → ignore the tap (optionally brief "processing" indicator). |
| 5 | **AI Chat mic independent of toggle** | Chat mic stays always-available regardless of "Listen & Speak" state. Toggle only controls the Home halo. |

## 6. LunaOverlay mic halo (UI)

- Positioned beside Luna's head, above the `dockBottom` container; separate
  touch target ≥ 44×44 pt with `accessibilityLabel` / `accessibilityRole`.
- **Idle:** soft pulsing glow (Reanimated `withRepeat(withTiming(0.6→1))`),
  honors `useReducedMotion`.
- **Listening:** bright pulsing pink ring + speech-bubble "wave" state; mic
  auto-closes on final/timeout.
- **Processing → Replying:** brief spinner; reply bubble + TTS via existing
  `showBubble` → `voiceService` path.
- Rendered only when `listenAndSpeak === true && !isHidden && installStatus === 'ready'`.
- Tapping Luna herself stays unchanged (period forecast / health tip).

## 7. Verification

1. `cd mobile` → `npx tsc --noEmit` (clean).
2. ESLint on changed files (no NEW errors; screens have pre-existing
   `react-native/no-inline-styles` — leave untouched).
3. Jest: `npx jest --testTimeout 30000` → all suites pass except the
   known pre-existing `symptomIcons.parity` failure (verify it still fails on
   `HEAD` — unrelated).
4. **New test** `useLunaMicSession.test.ts` asserts:
   - tap → final keyword → `showBubble(cardReply)`.
   - tap → final non-keyword → fallback bubble.
   - 10 s timeout / error → mic closes, no crash.
   - tap-again during session → early stop.
5. **No native rebuild.** JS changes only → Metro hot-reload on device
   (Metro `192.168.0.100:8081`, device `0965731342095242`).

## 8. Out of scope

- Wake-word / "Hey Luna" hotword detection.
- Home continuous listening under any configuration.
- AI Chat microphone redesign (input-bar button already matches tap-to-speak).
- New native modules, new permissions, background audio.

## 9. PR checklist

- [ ] `useHomeAlwaysListening.ts` + `useShouldListen.ts` deleted, no dangling imports.
- [ ] `HomeDashboardScreen.tsx` no longer mounts `HomeAlwaysListening`.
- [ ] `LunaOverlay` shows mic halo per §6 and hides when toggle OFF / hidden / not installed.
- [ ] `useLunaMicSession` respects 10 s auto-stop, permission-at-first-tap, TTS guard.
- [ ] Settings caption updated; main plan + `luna_guide.md` consistent.
- [ ] `tsc`, eslint, jest pass (excluding pre-existing parity failure).
