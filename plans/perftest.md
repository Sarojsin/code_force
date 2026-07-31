# Perf Test Remediation Plan — SheCare Mobile

> **Target:** Fix every issue exposed by the 18-test diagnostic (`perftest` prompt) — keyboard, scroll, tap latency, offline/sync, Luna, first-launch, ANR, battery.
> **Current:** 3 guaranteed failures (Tests 3, 10, 11) + systemic JS-thread SQLite blocking behind Tests 5–7, 12–14, 17.
> **Priority:** HIGH — offline save is a data-loss bug; sync SQLite blocking is the top systemic perf risk.
> **Owner:** Mobile (frontend_rules.md), governed by `plans/30-mobile-api-contract.md` where API shape is touched.

---

## 1. Overview

This plan fixes the findings from the code audit, mapped 1:1 to the diagnostic test matrix. It is ordered so that **low-risk, high-value fixes land first** and the **systemic SQLite change lands last** (it has the most test churn).

No backend contract changes are required. Any future request/response change must update `plans/30-mobile-api-contract.md` in the same PR.

---

## 2. Root Cause Register

| # | Root cause | Location | Symptom (test) | Severity |
|---|-----------|----------|----------------|----------|
| R1 | JournalEntryScreen uses its own inline mutation → **no offline enqueue, no local write** | `mobile/src/screens/wellness/JournalEntryScreen.tsx:174-186` | Test 11 — entry lost in Airplane Mode | 🔴 Data loss |
| R2 | MoodLogScreen has the same inline-mutation bypass | `mobile/src/screens/wellness/MoodLogScreen.tsx:104` | Test 11 variant (mood log) | 🔴 Data loss |
| R3 | LogPeriodScreen renders dates as plain text inputs, no native picker | `mobile/src/screens/cycle/LogPeriodScreen.tsx:108-110` | Test 3 — cannot "select a date" | 🟡 Functional |
| R4 | SOS countdown: `setInterval(100ms)` + `setCountdown` re-renders whole screen 10×/s incl. SVG ring | `mobile/src/screens/safety/SOSActiveScreen.tsx:68-79,161-162` | Test 10 — ring jank, sticky Cancel | 🔴 UX |
| R5 | Luna float: `withSequence(withTiming(...))` created **inside** `useAnimatedStyle` → animation restarts on every re-render | `mobile/src/screens/companion/LunaOverlay.tsx:111-122` | Test 16 — stutter/teleport | 🟡 UX |
| R6 | `openDatabaseSync` — **synchronous SQLite on the JS thread**; all drizzle + raw calls block the UI | `mobile/src/db/connection.ts:9,17` | Tests 5,6,7,12,13,14,17 | 🔴 Systemic |
| R7 | Diary search executes `getAllSync` (FTS5) per debounced keystroke on main thread | `mobile/src/services/localDb/DiarySearchLocalService.ts:21,32` | Test 13 — typing lag | 🔴 |
| R8 | Sync hydration + backfill + prune all write/read SQLite synchronously | `syncHydrate.ts:89-98`, `App.tsx:88-94`, `pruneLocalDb.ts:25-47`, `syncPlaceholders.ts:40,49,241` | Tests 5,6,7,12,14,17 | 🔴 |
| R9 | Journal screen re-renders entire component on every keystroke via `watch('content')` | `JournalEntryScreen.tsx:201-208` | Test 2 — input lag | 🟡 |
| R10 | No `returnKeyType="next"` focus chaining in auth/onboarding forms | `FormField.tsx:49` (ref plumbing exists but unused) | Tests 1, 4 | 🟢 |
| R11 | Background fetch fixed 15-min + location fetch on every foreground + Luna JS idle interval keeps JS awake | `App.tsx:130-137,164-166`, `LunaOverlay.tsx:170-203` | Test 18 — battery | 🟢 |

---

## 3. Phase 1 — Data-loss & functional blockers (risk: low, ship first)

### 3.1 Journal offline save (R1)

**Change:** `mobile/src/screens/wellness/JournalEntryScreen.tsx`

- Delete the inline `createMutation` (lines 174-186) and the `useMutation`/`useQueryClient` imports no longer needed.
- Use the existing offline-aware hook `useCreateJournalEntry()` from `src/services/queries` (`queries/wellness.ts:31`), which already enqueues to `useOfflineStore` on network error, upserts SQLite on success, invalidates cache, and shows the "Saved offline" toast.
- Keep the existing draft autosave + `beforeRemove` flush (lines 141-172) — they are correct.
- `onSubmit` stays the same; call `createMutation.mutate({ title, content })`.

**Verification:** unit — extend `queries/__tests__/wellness.test.ts` expectations for the screen path; manual — run Test 11.

### 3.2 MoodLog offline save (R2)

**Change:** `mobile/src/screens/wellness/MoodLogScreen.tsx:104`

- Same pattern: replace inline mutation with `useCreateMoodLog()` (`queries/wellness.ts:73`).

### 3.3 Native date pickers on Log Period (R3)

**Change:** `mobile/src/screens/cycle/LogPeriodScreen.tsx`

- Replace `FormField` for `startDate` / `endDate` (lines 108-110) with `DatePickerField` from `src/components/ui` (same component used in `CalendarScreen.tsx:325` and `CyclePredictionsScreen.tsx:187`; powered by `@react-native-community/datetimepicker` ^9.1.0).
- Remove `notes` stays as `FormField` (only the two dates change).
- Verify the zod schema still binds to the same field names (`startDate`, `endDate`).

**Acceptance:** Test 3 becomes executable: tapping the field opens the native picker; picking a date does **not** summon or flicker the keyboard.

---

## 4. Phase 2 — UI-thread animation fixes (risk: low)

### 4.1 SOS countdown ring (R4)

**Change:** `mobile/src/screens/safety/SOSActiveScreen.tsx`

- Replace the JS `setInterval`/`setCountdown` re-render loop (lines 66-79) with a Reanimated timing loop on a shared value, e.g.:
  - `progress = useSharedValue(0)`; on mount `progress.value = withTiming(1, { duration: 2000, easing: Easing.linear })`.
  - Drive `strokeDashoffset` from a `useAnimatedStyle` (UI-thread, zero React re-renders).
  - Keep a lightweight JS interval (e.g. 200ms) **only** for the numeric countdown text and for the haptic ticks at whole seconds.
- `handleTriggerSos` triggers from the `withTiming` completion callback (`runOnJS`), not from `countdown === 0` in a derived render.

**Acceptance:** Test 10 — ring animates smoothly at 60fps, Cancel press responds immediately, no "sticky" button.

### 4.2 Luna float animation (R5)

**Change:** `mobile/src/screens/companion/LunaOverlay.tsx:111-122`

- Stop creating animations inside `useAnimatedStyle`. Pre-create shared values and start animations from `useEffect`/event handlers:
  - `floatY = useSharedValue(0)`; run a `withRepeat(withSequence(withTiming(-6, ...), withTiming(0, ...)), -1, true)` loop in a `useEffect` keyed on `context.animation` / `reduceAnimations`.
  - `walkX` already exists (lines 99-109) — move the same pattern to `bounce`/`float`.
  - `useAnimatedStyle` then only reads `.value` (pure mapping, no animation creation).
- Guard the 4s idle interval (lines 170-203) so it doesn't run while the app is backgrounded or when `reduceAnimations` is set.

**Acceptance:** Test 16 — no restart/teleport on speech or XP updates; float is a stable 60fps loop.

---

## 5. Phase 3 — Move SQLite off the JS thread (risk: high, biggest win)

This is the systemic fix behind R6–R8. `expo-sqlite ~57.0.1` (package.json:56) supports the async API. The sync driver blocks the JS thread; the async driver executes on the SQLite worker thread.

### 5.1 Connection layer

**Change:** `mobile/src/db/connection.ts`

- Replace `openDatabaseSync('shecare.db')` with `openDatabaseAsync('shecare.db')`.
- Introduce async init that is awaited once (lazy promise, not a singleton imported at module scope — per AGENTS.md §1.3 DI rules):
  - `let initPromise: Promise<{ db, nativeDb }> | null = null;`
  - `export function getDb(): Promise<...>` and `export async function getNativeDb(): Promise<SQLiteDatabase>`.
- Keep `closeDb()` but make it async and reset `initPromise`.
- Do **not** keep both drivers — mixing a sync handle and async handle on one file can double-open the DB.

**Note:** All `getDb()`/`getNativeDb()` call sites must become `await`-based. Full caller list is in 5.2/5.3.

### 5.2 Drizzle-backed services (async for free)

**Change:** `mobile/src/services/localDb/BaseLocalService.ts` (and all subclasses)

- With an async handle, `drizzle(nativeDb)` in `getDb()` returns real promises — `upsert`, `getById`, `getAllByUser`, `softDelete`, etc. become genuinely non-blocking with **no per-service edits**.
- Confirm `drizzle-orm/expo-sqlite`'s `useMigrations(getDb(), migrations)` in `App.tsx:74` accepts the async DB (it does — same driver). If the migrator needs the raw native handle, pass `await getNativeDb()`.

### 5.3 Raw sync call sites (must be converted manually)

| File | Calls | Action |
|------|-------|--------|
| `services/localDb/DiarySearchLocalService.ts:21,32` | `getAllSync`, `execSync` | → `getAllAsync`, `execAsync`; make `search`/`rebuildIndex` already-`async` (they are) |
| `services/localDb/syncPlaceholders.ts:40,49,241` | `getAllSync`, `getFirstSync` | → async helpers (`safeQuery`/`safeFirst` return promises); propagate `await` to all `placeholder*` fns |
| `services/localDb/pruneLocalDb.ts:25-47` | `runSync` | → `runAsync`; make `pruneLocalDb` async; `App.tsx:89` awaits it |
| `stores/safetyStore.ts:19` | `getFirstSync` | → `getFirstAsync` inside `readActiveSosFromLocal` (make it async, update caller) |
| `services/sync/dbMaintenance.ts:23` | `execSync('VACUUM')` | → `execAsync`; keep scheduled on idle only |

### 5.4 Keep the good batching

`syncHydrate.ts:89-98` already batches (25) and `await idle()` between batches, and `writeThroughHelpers.ts:4-12` chains writes through `requestIdleIdle`. **Keep both** — they now benefit from non-blocking writes. Do not remove the yielding.

### 5.5 Test mocks

Jest mocks that stub `openDatabaseSync` must switch to stubbing the async API:

- `src/__tests__/test_system_test5_scenarios.test.ts:35`
- `src/__tests__/test_system_test9_scenarios.test.ts:14`
- `src/__tests__/test_system_test8_scenarios.test.ts:70`
- `src/__tests__/syncEngine.test.ts:19`
- `src/services/queries/__tests__/cycle.test.ts:7`
- `src/__tests__/storage_integration.test.ts:99-107` (already has `getAllSync` mock — flip to async, plus any `openDatabaseAsync`)

Add `openDatabaseAsync: jest.fn(() => Promise.resolve({ getAllAsync: jest.fn(), getFirstAsync: jest.fn(), runAsync: jest.fn(), execAsync: jest.fn() }))`.

### 5.6 Acceptance for Phase 3

- `npm run typecheck` and `npm run test` pass with the async mocks.
- Test 13: FTS search no longer blocks typing (JS thread free).
- Test 11/12: save instant, reconnect sync doesn't freeze the UI.
- No behavior change to the API contract.

---

## 6. Phase 4 — Rendering & input robustness (risk: low)

### 6.1 Journal screen per-keystroke re-render (R9)

**Change:** `mobile/src/screens/wellness/JournalEntryScreen.tsx`

- Isolate the keystroke re-render: move the `content` `TextInput` (the `Controller` block, lines 292-328) into a memoized child component that receives `onChangeText`/`value` and subscribes to `useFormContext` (or `useController`) locally — so only the textarea re-renders while typing, not the mood grid / energy row / symptom pills.
- Compute the sentiment badge from `watch('content')` in a small child too, or gate it behind the already-debounced idle path.
- Keep `MOODS`, `ENERGY_LEVELS`, `SYMPTOMS` arrays outside the component (already are).

**Acceptance:** Test 2 — smooth typing, no visible lag on mid-range devices; mood/symptom selectors no longer re-render per keystroke.

### 6.2 Focus chaining (R10)

**Change:** `mobile/src/screens/auth/LoginScreen.tsx` (email→password) and `mobile/src/screens/onboarding/PersonalInfoScreen.tsx` (age→height)

- `FormField` already accepts `inputRef` (`FormField.tsx:19`) — add `returnKeyType="next"` on the first field and wire `onSubmitEditing={() => secondRef.current?.focus()}`.
- Verify `KeyboardAvoidingWrapper`'s `keyboardShouldPersistTaps="handled"` (component already sets it) keeps the keyboard open across focus switches.

**Acceptance:** Tests 1 & 4 — keyboard never closes/flickers while switching fields.

### 6.3 Predictions history (Test 7)

**Change:** `mobile/src/screens/cycle/CyclePredictionsScreen.tsx:153-177`

- If history grows past ~30 rows, swap the `<View>` map for `@shopify/flash-list` (already in deps, package.json:32) with fixed row height.
- Add the existing SQLite placeholder fallback (`syncPlaceholders.placeholderCyclePredictions`) behind `useNetworkAwareQuery` (`queries/useNetworkAwareQuery.ts`) so the table renders instantly offline.

---

## 7. Phase 5 — Startup & first launch (risk: medium)

### 7.1 Migration gate

**Change:** `mobile/src/app/App.tsx:73-108`

- Keep migrations before UI (schema must exist before queries run — AGENTS.md §1.4). Do **not** move migrations async *behind* first paint; the gate is correct.
- Move the post-migration work `pruneLocalDb()`, `migrateStoreDataToSqlite()`, `cleanupObsoleteKeys()`, `backfillSqliteIfNeeded()` (lines 88-94) out of `runAfterInteractions` into a **chunked idle queue** (`requestIdleIdle`) that yields between table batches, and surface a one-line progress state instead of blocking.
- `backfillSqliteIfNeeded` must paginate (`limit`/`offset`) its server fetch and insert in batches of ≤ 50 with `await idle()` between them.

**Acceptance:** Test 14 — app interactive fast after install; no long blank/ANR window on cold start.

### 7.2 Splash polish

- If the gate is visible, render the existing splash art + a determinate progress bar instead of a bare spinner ("Preparing your data..." stays).

---

## 8. Phase 6 — Background & battery (risk: low)

**Change:** `mobile/src/app/App.tsx` and `mobile/src/screens/companion/LunaOverlay.tsx`

- Background sync task (lines 51-59, 130-137): respect the sync metrics store — skip if a sync completed < 5 min ago; respect a backoff counter on repeated failures.
- Gate `updateLastKnownLocation()` (lines 61-71, 164-166) to run only when the sync metrics say the app is foreground-active and on cellular/Wi-Fi, not on every `AppState` resume within a minute.
- Luna: pause the 4s idle interval and the float loop when `AppState !== 'active'` (already has an AppState listener at line 222 — extend it) and keep `reduceAnimations` honored.

**Acceptance:** Test 18 — no abnormal drain; verify via battery stats over one hour of mixed use.

---

## 9. Verification — re-run the diagnostic matrix

### 9.1 Build

```bash
eas build --platform android --profile production   # never judge perf on dev client
```

### 9.2 Measurement checklist (record before → after)

| Metric | Where | Tool |
|--------|-------|------|
| Scroll frame rate | Cycle History, Journal List, Diary | Dev menu → FPS monitor (release-adjacent build) |
| Save latency (journal offline) | Test 11 | stopwatch; expect < 100 ms visual ack |
| Search keystroke latency | Test 13 | stopwatch per char on a 200-entry diary |
| SOS ring smoothness | Test 10 | FPS monitor |
| Cold start to interactive | Test 14 | stopwatch from tap to first screen |
| JS thread blocking during sync | Test 12 | `sync_cycle_completed`/`recordSqliteWrite` logs (perf.now spans already in `syncHydrate.ts:46`) |

### 9.3 Test matrix (must all pass)

| Test | After this plan | Owner |
|------|-----------------|-------|
| 1, 4 Keyboard persistence | Phase 4.2 | QA device matrix (Android + iOS) |
| 2 Journal typing | Phase 4.1 | QA |
| 3 Date pickers | Phase 1.3 | QA |
| 5, 6 Scroll | Phase 3 | QA + FPS monitor |
| 7 Predictions | Phase 3 + 6.3 | QA |
| 8, 9 Tap/navigation | Phase 3 (no regression) | QA |
| 10 SOS countdown | Phase 2.1 | QA |
| 11 Offline journal save | Phase 1.1/1.2 | QA — **must** survive force-quit |
| 12 Reconnect sync | Phase 3 | QA + sync logs |
| 13 Diary search | Phase 3 + debounce | QA |
| 14 First launch | Phase 5 | QA |
| 15 Pull-to-refresh | Phase 3 | QA |
| 16 Luna | Phase 2.2 | QA |
| 17 ANR | Phase 3 + 5 | QA — no ANR dialogs on Android 14 budget device |
| 18 Battery | Phase 6 | QA + battery stats |

### 9.4 CI gates

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm test` — full suite, incl. updated SQLite mocks (5.5) and new JournalEntryScreen offline test
- E2E (Maestro/Detox): login → log period → SOS → offline journal save → reconnect sync

---

## 10. Risks & rollback

| Risk | Mitigation |
|------|-----------|
| Async SQLite migration touches ~8 mock files + 6 real call sites | Land Phase 3 as its own PR; run full suite before merging; keep `syncHydrate` batching |
| `useMigrations` behavior with async driver | Verify early in Phase 3.1 with a single-device smoke test before converting call sites |
| Reanimated worklet changes (SOS, Luna) | Isolated components; revert to interval loop if any regression appears |
| `backfillSqliteIfNeeded` pagination changes server load | Add `limit`/`offset` params to the existing call only; no contract change |

Rollback: each phase is a separate commit. Phase 1/2 are pure client changes with instant revert. Phase 3 is the only one requiring coordinated re-verification — keep the sync driver swap behind the connection module so reverting `connection.ts` + 5.3 sites reverts the whole change.

---

## 11. Suggested commit sequence

1. `fix(journal): use offline-aware useCreateJournalEntry` → closes Test 11
2. `fix(mood): use offline-aware useCreateMoodLog` → closes Test 11 (mood)
3. `feat(cycle): native date pickers on Log Period` → closes Test 3
4. `perf(sos): Reanimated countdown ring` → closes Test 10
5. `perf(luna): stable float animation outside useAnimatedStyle` → closes Test 16
6. `perf(db): async SQLite driver + convert sync call sites` → closes Tests 5,6,7,12,13,14,17
7. `perf(journal): isolate textarea re-render + focus chaining` → closes Tests 1,2,4
8. `perf(startup): chunked backfill/prune after first paint` → closes Test 14
9. `perf(background): sync backoff + battery` → closes Test 18
