# Luna2 Phase 2 — Deeper Personality & Memory (on-device)

> Phase 2 turns Luna from a reactive companion into one with persistent memory,
> habits awareness, and context-sensitive dialogue. **Fully offline.** No cloud,
> no content leaves the device. Builds on the existing `MoodManager`,
> `EmotionEngine`, and `DialogueEngine`.

---

## 1. Schema — companion memory

### 1.1 New table `companion_memory` (mobile local DB)

In `mobile/db/schema.ts` + migration (module-owned, per backend §1.4 the DB is
mobile-local SQLite via `expo-sqlite` + drizzle):

| column | type | notes |
|---|---|---|
| `key` | TEXT (PK) | e.g. `habit.sleep_avg_hour`, `pref.pet_frequency`, `mood.week_aggregate` |
| `value` | TEXT (JSON) | serialized payload |
| `updated_at` | INTEGER (ms) | LWW / TTL bookkeeping |
| `created_at` | INTEGER (ms) | row creation — required for pruning (§2) |

Rationale: key-value keeps schema stable while memory kinds grow.

### 1.1a Pruning strategy (hard limits — prevent SQLite bloat)

Memory is a rolling, bounded store. Enforced in MemoryService on every write:

- **Time-based:** prune rows with `created_at` older than **60 days**.
- **Row-cap:** total rows capped at **1000**; when exceeded, delete
  oldest-`created_at` rows (LRU by creation) until under cap.
- Whichever triggers **first** wins. Runs once per write (cheap
  `DELETE ... WHERE`), not a background job.
- Aggregates (`mood.week_aggregate`, `habit.*`) are recomputed values, not
  raw events — keep their row, prune only old raw event keys.

### 1.2 Extend `companion_metadata` (existing table)

Add columns (drizzle migration):
- `relationshipLevel` INTEGER (default 1) — separate from XP `level`.
- `lastSeenAt` INTEGER (ms) — last app foreground with Luna.

### 1.3 Encryption

Per AGENTS.md §2.2 / §8: memory values go to **encrypted storage**
(`react-native-encrypted-storage`) mirror, or encrypt the JSON payload with the
existing encryption service before writing to SQLite. Decision: write plaintext
`key` + encrypted `value`; decrypt in the service layer only.

---

## 2. MemoryService

New `mobile/src/services/companion/memoryService.ts`:

```ts
interface MemoryService {
  recordHabit(type: HabitType, value: number, logged_at?: Date): Promise<void>;
  getHabitAverage(type: HabitType): Promise<number | undefined>;
  getContextSnapshot(): Promise<MemoryContext>;
  prune(): Promise<number>; // returns rows removed; called internally on write
}
```

- `recordHabit` takes the **actual measured value** (sleep hours, water
  glasses, steps, mood score, etc.) and the timestamp of the log event
  (`logged_at`, default `now`). The `type` tells us WHICH habit; `value`
  carries the measurement — both are required inputs to average correctly.
- `logged_at` becomes the row's `created_at`; `updated_at` is LWW bookkeeping.
- `prune()` is invoked inside every write (enforces §1.1a limits).

`MemoryContext` = the input the DialogueEngine uses:
- sleep average hour, water/food/exercise/medication streak state
- frequent log types (last 14 days)
- cycle phase awareness (via `companionMetadata` / `healthMetrics`)
- recent mood trend (from `MoodManager` history)
- pet frequency, time-of-day of usage

Feeding sources (already emitting events → subscribe in EventEngine or hook
here):
- `sleep_logged`, `water_logged`, `food_logged`, `exercise_logged`,
  `medication_logged`, `mood_logged`, `period_logged`, `pet` interactions.

Aggregation window: rolling 14 days for averages; **hard pruning at 60 days /
1000 rows** (see §1.1a).

---

## 3. DialogueEngine enrichment

### 3.1 Context resolution

Enhance `DialogueEngine.get(context, moodContext)` so that when `context` is
non-empty it also consults `MemoryContext`:

- **Habit-aware:** "You've been logging sleep around 11pm — need a wind-down
  tip?" (only after >= 3 consistent samples to avoid nagging).
- **Cycle-aware:** if period expected within ~3 days → support/empathy pool.
- **Streak-aware:** reuse `getStreakMessage` + add streak *trend* (up 3 days vs
  flat).
- **Milestone-aware:** relationship-level ups + achievement chains
  (e.g. hydration 5 → 30 → "you're turning into a hydration hero!").
- **Time-of-day:** already partially present (`late_night`/`evening`/`morning`/
  `encouragement`) — keep, now fed with memory.

### 3.2 "Remembered" callbacks

Add `memoryRecall` dialogue keys:
- "You slept 3h late today — everything ok?"
- "Last time you felt this way you went for a walk. Want to try again?"
Requires: mood trend + previous mood + a remembered action suggestion.

### 3.3 Data

- Add new dialogue pools to `mobile/src/assets/companion/dialogues.json`.
- Keep `FALLBACK_DIALOGUES` as the offline/no-memory fallback.
- Version bump dialogue file inside the DLC zip (Phase 1 §5) OR bundle update —
  pick one; keep `DialoguesEngine` merge logic intact.

---

## 4. Mood persistence across sessions

Current: `EmotionEngine` seeds from `companionStore.memory.moodHistory`.
Extend:
1. Persist mood history aggregates (week-over-week) into `companion_memory`
   (`mood.week_aggregate`).
2. On app open: hydrate `MoodManager` from memory BEFORE first dialogue pick.
3. Relationship level increments on cumulative XP thresholds (separate from
   XP `level` titles), stored in `companion_metadata.relationshipLevel`.

---

## 5. Files touched

- `mobile/db/schema.ts` + migration (`companion_add_memory.py` style)
- `mobile/src/services/companion/memoryService.ts` (new)
- `mobile/src/services/companion/DialogueEngine.ts`
- `mobile/src/services/companion/EventEngine.ts` (feed habits)
- `mobile/src/services/companion/MoodManager.ts` / `EmotionEngine.ts`
- `mobile/src/assets/companion/dialogues.json`
- `mobile/src/stores/companionStore.ts` (relationship level + lastSeen)
- `mobile/src/screens/companion/LunaOverlay.tsx` (hydrate on foreground)

---

## 6. Tests & verification

- `mobile/src/__tests__/companion/memoryService.test.ts`:
  - `recordHabit(type, value, logged_at)` → correct average; missing `value`
    is a compile/type error (required param).
  - **pruning:** writes beyond 60-day age removed; row cap at 1000 enforced
    (LRU by `created_at`); recomputed aggregate rows never pruned.
  - encrypted value round-trip.
- `mobile/src/__tests__/companion/dialogueMemory.test.ts`:
  context resolution — habit-aware / cycle-aware / streak / milestone picks.
- `mobile/src/__tests__/companion/emotionEngineMemory.test.ts`:
  hydration from memory; relationship level thresholds.
- **Integration — event bus → memory:** `memoryEventIntegration.test.ts` —
  emit `sleep_logged`/`mood_logged` via the real event bus → MemoryService
  records habit + value + timestamp → `getContextSnapshot()` reflects it;
  duplicate events don't double-count; `prune()` bounded.
- Existing `companion/*` suites pass; `tsc --noEmit` clean.
- Manual: log sleep 3 nights → Luna references bedtime; change a habit → Luna
  notices within 14-day window; long usage → table stays < 1000 rows.

---

## 7. Exit criteria (Phase 2)

- `companion_memory` table + migration shipped (incl. `created_at`); values
  encrypted at rest.
- MemoryService records habits with measured value + timestamp; pruning keeps
  the table bounded (60 days / 1000 rows hard cap).
- DialogueEngine resolves context using memory (habit/cycle/streak/milestone).
- Mood persists across restarts; relationship level tracks cumulative XP.
- All new + existing companion tests green; tsc clean.

---

## 8. Execution status (2026-08-06) — IMPLEMENTED, tests green

### Implemented
- **Schema (§1.1/§1.2):** `mobile/src/db/schema.ts` — new `companion_memory`
  table (`key` TEXT PK, `value` TEXT, `updated_at`/`created_at` INTEGER ms, GIN
  index on `created_at`) and `companion_metadata` gained `relationship_level`
  INTEGER default 1 NOT NULL + `last_seen_at` INTEGER (ms).
- **Migration:** `0009_add_companion_memory.sql` (CREATE TABLE + 2× ALTER TABLE),
  registered in `migrations.js` + `meta/_journal.json` (idx 9, version 9,
  when 1792600000000). Runs via `drizzle-orm/expo-sqlite/migrator` in
  `jest.setupAfterEnv.js`.
- **Encryption (§1.3):** `memoryService.ts` writes plaintext `key` + encrypted
  `value`; `memoryCrypto.ts` encrypts/decrypts AES-256-GCM via `expo-crypto`
  with a per-user key in `EncryptedStorage` (`shecare.luna.memory.key.<uid>`),
  generated once, cached in-memory; decrypt failure → treated as unreadable.
  Only the service layer sees plaintext.
- **MemoryService (§2):** `recordHabit(type, value, loggedAt?)`,
  `getHabitAverage`, `recordMood`, `recordPet`, `recordPeriod`,
  `recordPeriodPrediction`, `getContextSnapshot`, `prune`, `hydrateMemory`,
  `initMemoryService` (event-bus subscriptions). Keys: `habit.<type>.<day>`,
  `pref.pet.<day>`, `mood.history`, `mood.week_aggregate.<weekStart>`,
  `cycle.last_period`, `cycle.period_prediction`. Per-day keys are idempotent
  (LWW upsert) so duplicate events never double-count.
- **Pruning (§1.1a):** 60-day TTL on raw keys (`habit.%`, `pref.pet.%`) + 1000-row
  cap (oldest-`created_at` raw rows deleted first). Aggregates
  (`mood.history`, `mood.week_aggregate.%`, `cycle.%`) are never pruned.
  Runs once per write.
- **DialogueEngine (§3):** `setMemoryContext(snapshot)` + pure exported
  `resolveMemoryDialogue(context, memory, moodContext?)` — habit-aware
  (sleep ≥22h avg with ≥3 samples → `memory_sleep_late`; water avg ≥6 →
  `memory_water_hero`; exercise/medication streak ≥3 → `memory_streak` /
  `memory_medication_consistent`), cycle-aware (`period_approaching` 0–3 days →
  `memory_period_due`), mood-recall (declining + sad/anxious + ≥3 samples →
  `memory_mood_recall`), welcome-back (≥2 days away → `memory_welcome_missed`).
  7 new `memory_*` pools added to `dialogues.json` + `FALLBACK_DIALOGUES`.
- **Mood persistence (§4):** `hydrateMemory()` restores `moodHistory` into the
  store and updates `last_seen_at`; `EmotionEngine`/`MoodManager` now export
  `MOODS`/`MOOD_SCORES` and `createEmotionEngine()` seeds from store memory.
- **Relationship level (§1.2):** `RELATIONSHIP_THRESHOLDS =
  [100,500,2000,10000,50000]`, `calculateRelationshipLevel(xp)` (5 levels above
  1) exported from `CompanionLocalService`/`companionStore`; `addXP` persists
  `relationship_level`.
- **Wiring:** `EventEngine` calls `initMemoryService()`; welcome handler
  hydrates memory before showing the bubble; `LunaOverlay` hydrates on mount +
  `AppState` foreground. Barrel exports `memoryService`, `initMemoryService`,
  `MemoryContext`, `HabitType`.

### Verification
- **New tests (36):**
  - `memoryService.test.ts` (12) — averages, same-day dedupe, encrypted
    round-trip (ciphertext ≠ plaintext), TTL prune, aggregate retention, 1000-row
    LRU cap, snapshot (habits/streaks/frequent types/sleep hour/pet count/mood
    trend/cycle/relationship), hydrateMemory.
  - `dialogueMemory.test.ts` (15) — every `resolveMemoryDialogue` condition +
    negative cases, engine `get()` memory-pool pick, static fallback, bundled
    memory pools.
  - `emotionEngineMemory.test.ts` (4) — relationship thresholds + XP→level
    persistence, MoodManager hydration from memory, seeded history, restart
    survival.
  - `memoryEventIntegration.test.ts` (5) — event-bus write-through for all 10
    subscribed events, pet count value, duplicate-emit idempotency, unknown-mood
    sanitization, clean unsubscribe.
- **Full companion suite:** 12 suites / 89 tests pass.
- `npx tsc --noEmit` clean.
- Pre-existing unrelated failures unchanged: `test_system_test15_scenarios`
  (Scenario 49) + `services/queries/__tests__/wellness` (DB errors).

### Notes / decisions
- `prune()` is global (no per-user scoping) — the table is device-local single
  user; matches §1.1a.
- Memory values carry `MOOD_SCORES` and per-day habit values (beyond the plan's
  minimal `{value}` shape) so snapshot math is exact.
- Tests mock `EncryptedStorage` + reuse the existing `expo-crypto` AES test
  double (`SEALED.<base64>` reversible) so encryption round-trips run in-memory.
- Remaining manual checks (§6): sleep-3-nights → bedtime reference; long-usage
  table < 1000 rows; device smoke test on `0965731342095242`.
