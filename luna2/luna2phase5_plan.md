# Luna2 Phase 5 — More Event Reactions (diary + cycle)

> Phase 5 expands the set of app events Luna reacts to. Today the mobile event
> bus feeds 11 reactions (journal, mood, period, water, food, exercise,
> medication, sleep). This phase wires the **diary** hooks defined in
> `plans/diaryplan10.md §9` (currently "no-op in V1") plus **cycle**-aware
> reactions, and adds a backend `day_logged` → Luna mood bridge so the synced
> aggregate state (Phase 4) stays fresh.

---

## 1. Diary event hooks (from diaryplan10.md §9)

> **BLOCKER — diary emitters do NOT exist yet.** The diary module has never
> emitted these events (diaryplan10 §9 marked them "no-op in V1"). Phase 5
> cannot start until the emitters are in place and tested, otherwise the
> event-flow tests will fail with silent no-ops.

### 1.0 Pre-work (mandatory): emitter audit

Before wiring reactions, audit the diary local services:
- `mobile/src/services/diary/` — identify `DiaryLocalService`,
  `DiaryPageLocalService`, `DiaryMediaLocalService` (or equivalent names).
- For each of the 5 events, confirm the exact point in the service where the
  mutation happens (create page / add photo / save page / open page / sync
  media).
- Add the missing `eventBus.emit('<event>', payload)` calls at those points —
  mirror how `JournalLocalService` / `MoodLocalService` emit `*_logged`
  (including payload shape and any `user_id`).
- Guard each emit so a diary feature being disabled never throws.

Events to subscribe in `mobile/src/services/companion/EventEngine.ts`:

| event | Luna reaction |
|---|---|
| `diary_page_created` | happy animation + "new page, new you" dialogue |
| `diary_photo_added` | wave/celebrate + "ooh, I saw that snapshot" |
| `diary_page_saved` | idle + soft encouragement |
| `diary_opened` | idle + "let's write something beautiful" |
| `diary_media_synced` | happy + XP bonus |

Requirements:
- Add `DIARY_REACTIONS` to `EVENT_REACTIONS` map (same shape: dialogContext,
  animation, durationMs, getMoodContext).
- XP/coin rewards for diary interactions (reuse `XP_REWARDS`/`COIN_REWARDS`
  tables).

## 2. Cycle-aware reactions

Existing:
- `period_logged`, `period_corrected`, `period_approaching` already in
  `EVENT_REACTIONS`.

Add:
- `day_logged` (mood bridge on DayDetailSheet save) → Luna mood reflection
  ("feeling it today — logged it. good job.").
- Cycle-phase context in DialogueEngine (already wired in Phase 2 §3.1):
  follicular/luteal/period phase → tailored support pool.

**Cycle service injection (required):** `DialogueEngine` must be able to read
the current cycle phase at dialogue-pick time. Do NOT reach into another
module's store directly (frontend §2.2 + module boundaries). Options, pick one
and implement consistently:
1. **Injectable accessor:** add `getCyclePhase(): CyclePhase | undefined` via
   the companion module's dependency holder (constructed with a local
   cycle/`companionMetadata` reader, injected at app init), OR
2. **Helper over local tables:** a small query helper that reads the local
   `cycle_entries` table (owned by the cycle module) through an existing
   exported service — NOT a raw cross-module table write.
- Result: `DialogueEngine.get(...)` receives `cyclePhase` in its context and
  picks the corresponding support pool. Test that the pick varies by phase
  (follicular vs luteal vs period).

## 3. Backend `day_logged` → Luna mood bridge

Mirror the wellness `_on_day_logged` pattern (`wellness/routes.py:272`):

- In `backend/app/modules/luna/` (or wellness) subscribe to `day_logged`.
- On event: refresh `LunaState.mood_trend` aggregate server-side (idempotent
  — recompute from stored samples, no double-count).
- Keeps the Phase 4 synced state fresh without client round-trips.

## 4. Event coverage test matrix

Extend `mobile/src/__tests__/companion/eventFlow.test.ts`:

- Every diary event → correct animation + dialogue pool + XP.
- `day_logged` → mood reflection + no crash when diary feature disabled.
- Cycle-phase dialogue pick varies by phase (follicular/luteal/period).
- **Emitter existence test:** each diary event string appears in the diary
  service source AND a runtime test subscribes, calls the diary service
  mutation, and asserts the event fired (guards against silent no-op).
- **Integration:** full event-bus flow — diary service emit → EventEngine
  reaction → bubble + animation + XP awarded (mocked UI).

## 5. Files touched

- `mobile/src/services/companion/EventEngine.ts`
- `mobile/src/services/companion/DialogueEngine.ts` (cycle-phase pools +
  injected `getCyclePhase`)
- `mobile/src/services/companion/3d/poseMapper.ts` (reuse, no change expected)
- **Diary module local services** (`mobile/src/services/diary/*`) — add the
  missing `eventBus.emit(...)` calls for the 5 diary events (blocker)
- Companion module init (`mobile/src/services/companion/index.ts` or app
  bootstrap) — inject `getCyclePhase`
- `mobile/src/__tests__/companion/eventFlow.test.ts`
- Backend luna/wellness subscriber for `day_logged`
- API contract: **no endpoint shape change** (state payload already supports
  mood_trend). Update contract doc only if payload semantics change.

## 6. Tests & verification

- jest `eventFlow.test.ts` extended (matrix above); existing suites green.
- **Diary emitter unit tests:** each diary service mutation emits the matching
  event with correct payload; disabled-feature guard no-throw.
- **Event-bus integration test:** subscribe → mutate diary → assert reaction
  fired end-to-end.
- `tsc --noEmit` clean.
- Backend: unit test the `day_logged` subscriber (idempotent, updates
  `mood_trend`).
- Manual:
  1. Create a diary page → Luna celebrates; photo → wave; save → soft nod.
  2. Log a DayDetail (day_logged) → Luna mood reflection.
  3. Cycle phase change → Luna dialogue shifts tone.
  4. Diary feature disabled → Luna stays quiet (no crash).

## 7. Exit criteria (Phase 5)

- **All 5 diary events actually EMIT from the diary services** (blocker
  cleared) AND Luna reacts to each; cycle-phase dialogue works via injected
  `getCyclePhase`.
- Backend `day_logged` → Luna mood bridge idempotent + tested.
- Event coverage matrix green (incl. emitter-existence + integration tests);
  no silent no-ops; contract unchanged unless payload semantics change (then
  updated in same PR).

---

## 8. Execution status

| Item | Status |
|---|---|
| §1.0 Blocker — diary emitters | ✅ `src/services/diary/diaryEvents.ts` (5 guarded emitters, auth-store userId fallback); wired: `useCreatePage.onSuccess` (`diary_page_created`), `useDiaryMediaUpload.enqueue` image branch (`diary_photo_added`), `DiaryEditorScreen.finishEditing` (`diary_page_saved`), `DiaryPageScreen` mount (`diary_opened`), `useDiaryMediaUpload.processQueue` post-`markUploaded` (`diary_media_synced`) |
| §1 DIARY_REACTIONS | ✅ `EVENT_REACTIONS` in `EventEngine.ts` (happy/wave/idle + pools `diary_page_created`/`diary_photo_added`/`diary_page_saved`/`diary_opened`/`diary_media_synced`); XP/coins in `companionStore.ts` (12/2, 5/1, 5/1, 2/0, 8/2) |
| §2 `day_logged` reaction | ✅ EVENT_REACTIONS + `day_logged` pool + mobile emit in `useUpsertDay.onSuccess` (`queries/cycle.ts`) |
| §2 Cycle-phase dialogue | ✅ `DialogueEngine.setCyclePhaseSource` + `cycle_phase_{phase}` pools; injected in `HomeDashboardScreen` via ref (only when `hasCycleData`); memory resolution still wins |
| §3 Backend `day_logged` → Luna mood bridge | ✅ Done in Phase 4 (`luna/routes.py` subscriber + `refresh_mood_trend_from_day_logged`, idempotent); verified green |
| §4 Test matrix | ✅ `eventFlow.test.ts` extended (diary + day_logged reactions, not-installed no-crash, full emit→reaction integration); `diaryEvents.test.ts` (payloads, auth-store resolution, guarded no-throw, source + wiring existence); `dialogueCyclePhase.test.ts` (per-phase pick variation) |
| Verification | ✅ `tsc --noEmit` clean; eslint clean on new files; jest 729/729; backend `pytest tests/modules/luna` 40/40 (incl. 6 day_logged/bridge/mood_trend) |
