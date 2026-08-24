# Phase G — P0/P1: Loading UX Standardization, staleTime Completion & Android Keyboard

> **Source audit:** `current_condition_ofapp/08_19_2026.md` §1.2–1.5, §2.1, §4.1, §4.3, PART 6 items #1, #2(partial), #6
> **Scope:** finish the `staleTime: 0` sweep (safety/family/pregnancy), standardize loading UI across the 6 bare-spinner screens, fix the For-You blank path, fix Android keyboard compression.
> **Gate:** `npm run typecheck && npm run lint && npm run test` must stay green.

---

## G.1 Finish the `staleTime: 0` sweep

Already done (Phase A.2 / B.3): diary queries, `useContents`, `useContentDetail`, `getJournalEntry` (inherits the `5min` global default from `app/providers.tsx:27`). **Verified remaining `staleTime: 0` overrides:**

| Query | File:line | Fix |
|---|---|---|
| `useEmergencyContacts` | `services/queries/safety.ts:31` | `staleTime: 5 * 60_000` |
| `useSosHistory` | `services/queries/safety.ts:180` | `staleTime: 5 * 60_000` |
| `useFamilyLinks` | `services/queries/family.ts:15` | `staleTime: 5 * 60_000` |
| `usePregnancyProfile` | `services/queries/pregnancy.ts:22` | `staleTime: 5 * 60_000` |
| `usePregnancyMilestones` | `services/queries/pregnancy.ts:61` | `staleTime: 5 * 60_000` |

**Keep as-is (live data):** `useActiveSos` (`safety.ts:167-174`, `refetchInterval: 30_000`), `usePregnancyDailyLogs` (`pregnancy.ts:40`), `usePregnancyRecommendations` (`pregnancy.ts:66`) — leave at default; they are inherently fresh.

**Also:** `JournalEntryScreen.tsx:63-66` `getJournalEntry` — add explicit `staleTime: 10 * 60_000` so the intent is local (not just the global default) and it can absorb `placeholderData` (see H.3).

**Acceptance:** no `staleTime: 0` remains in `src/services/queries/`; contact/family/pregnancy screens stop refetching on every focus.

---

## G.2 Standardize loading UI — shared ScreenLoader + kill the 6 bare spinners

**Verified bare `ActivityIndicator` call sites (empty background, no label/skeleton):**

- `JournalEntryScreen.tsx:175`
- `DailyLogScreen.tsx:182`
- `JournalListScreen.tsx:109`
- `MoodHistoryScreen.tsx:72`
- `InsightsScreen.tsx:29`
- `BreathingListScreen.tsx:39`
- `LazyScreen.tsx:31` (`size="small"`, centered, used as Suspense fallback for every lazy-loaded screen)

`components/ui/Loader.tsx` exists (overlay + accessibility) but is used by only 2 screens (`ContentDetailScreen`, `EditHealthScreen`).

**Changes:**
1. Add a shared `ScreenSkeleton` component (or extend `Loader.tsx` with a `label` + `skeleton` prop) in `components/ui/`:
   - props: `label?: string` ("Loading your cycle…"), `variant?: 'spinner' | 'skeleton-card' | 'skeleton-editor'`, `theme`-aware colors, `accessibilityRole="progressbar"` + `accessibilityLabel`.
   - Use `theme` tokens only (no hardcoded colors). Export via `components/ui/index.ts`.
2. Replace the 6 bare-spinner call sites above with the shared component. For card/tile screens use a skeleton-card variant matching the list row shape (so the screen has structure while loading); for detail screens a skeleton-editor variant (see G.4).
3. `LazyScreen.tsx:27-41` — swap the `<ActivityIndicator size="small">` fallback for the themed `ScreenSkeleton` (label "Loading…"): this is the Suspense fallback shown on every lazy chunk load, so it must look like every other loading state (audit §1.5 flagged it as too subtle).

**Acceptance:** every async screen shows the same loading language (label + shape); no `ActivityIndicator` remains directly in screen code outside buttons; typecheck/lint green.

---

## G.3 For-You blank path — skeleton in BOTH modes

**File:** `screens/wellness/VideoLibraryScreen.tsx`

Verified: the skeleton gate is still `if (isLoading && !forYou)` (`:93`). When `forYou` is on, loading falls through to the main render where `forYou && !hasData` (`:127-129`) shows the **NoSymptomsBanner** during the load — a misleading "no symptoms logged" while data is still fetching. Result: the "blank list during the 8 s wait" from §1.1 persists.

**Changes:**
1. Change the gate to `if (isLoading)` for **both** modes (`:93`), keeping the `LibraryHeader` visible.
2. When routing to For-You, show `SkeletonRows` + a `ScreenSkeleton label="Preparing your picks…"` while `isLoading && forYou`.
3. Show `NoSymptomsBanner` only when `!isLoading` (data arrived and genuinely no symptoms/hasData).
4. Keep the `isError` `EmptyState` branch (`:106-117`) as-is.

**Acceptance:** toggling For-You while loading shows a skeleton, never the NoSymptomsBanner and never a blank list.

---

## G.4 JournalEntryScreen — skeleton editor instead of spinner

**File:** `screens/wellness/JournalEntryScreen.tsx:171-179`

Verified: `if (entryLoading)` renders a bare `ActivityIndicator` on an empty background (audit §1.2: "blank-looking wait"; the entry query also lacks an explicit `staleTime` — handled in G.1).

**Changes:**
1. Replace the spinner with a `ScreenSkeleton variant="skeleton-editor"`: a title bar line + 4 body lines matching the editor layout.
2. Add a "Loading entry…" label; when hydration from the list placeholder occurs (H.3) show "Draft restored" / "Loading draft…" hints so the state is legible.

**Acceptance:** opening an entry shows a structured skeleton immediately, never a blank screen.

---

## G.5 DailyLogScreen — keep previous month visible + refreshing indicator

**File:** `screens/profile/DailyLogScreen.tsx:181-183`

Verified: `isLoading ? <ActivityIndicator size="large"/> : sortedDays...` — every month switch replaces the whole list with a bare spinner (audit §1.3). NOTE: the SQLite write batching behind this fetch was already fixed in Phase D (`withTransaction`), so only the **UI** part remains.

**Changes:**
1. Use `placeholderData: keepPreviousData` from `@tanstack/react-query` on the month query so the previous month's cards stay mounted while the new month loads.
2. While `isPlaceholderData`, show a non-blocking `refreshing` indicator at the top (styled like the pull-to-refresh spinner) instead of the bare center spinner.
3. First-load (no previous data) → shared `ScreenSkeleton` with skeleton day-cards (G.2 variant).

**Acceptance:** switching months keeps the old list visible with a subtle refreshing cue; no full-list spinner flash.

---

## G.6 Android keyboard — `behavior="height"` in both wrappers

**Verified files (audit §4.3):**

- `components/ui/KeyboardAvoidingWrapper.tsx:21-22` — `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`, `keyboardVerticalOffset={iOS ? 100 : 0}`.
- `components/ui/ScreenLayout.tsx:32` — same `undefined` on Android.

On Android `behavior: undefined` → RN relies on `adjustResize` which resizes the whole window and squashes the `ScrollView` (journal editor is the primary victim).

**Changes:**
1. Both wrappers: `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`; give Android a `keyboardVerticalOffset` that accounts for the header/tab (start with `0` for screens without a tab bar, verify on device with `adjustResize`).
2. Verify `app.json` keyboard config: set `softwareKeyboardLayoutMode: 'pan'` (or `resize`) for editor paths — confirm the chosen mode doesn't reintroduce compression on the journal / voice-journal screens.
3. Check `JournalEntryScreen`, `VoiceJournalScreen`, `EditHealthScreen`, `LogPeriodScreen`, `DailyLogScreen` (all use `KeyboardAvoidingWrapper`) on a physical device after the change — no layout compression, `keyboardShouldPersistTaps="handled"` still effective.
4. **Sync update:** `ScreenLayout.tsx:32` and `KeyboardAvoidingWrapper.tsx:21` must stay consistent (note Phase C change to Settings did not touch these).

**Acceptance:** on Android the journal editor no longer squashes; keyboard opens with the content panning/resizing predictably.

---

## G.7 Sub-threshold spinners & mixed sizes

**Files (audit §1.5):**
- `components/ui/wellness/.../BreathingExerciseCard.tsx:134` — in-button spinner `size="small"` → `large`.
- `Button.tsx:83` — in-button spinner has no explicit size; align with `Button` height (≥ 44 pt touch target), pick one consistent size.
- `LazyScreen.tsx:31` — covered by G.2.
- Unify spinner **color** to `theme.colors.primary` everywhere (some screens pass default gray; audit §4.1).

**Acceptance:** no `size="small"` spinners remain; every loading indicator uses primary color and ≥ visible contrast.

---

## Verification for Phase G
1. `npm run typecheck && npm run lint && npm run test`.
2. `rg "ActivityIndicator" src/screens src/components/ui` → only `Button`, `ScreenSkeleton` internals, and intentional in-button uses.
3. `rg "staleTime: 0" src/services/queries` → only intentional live queries (none expected after G.1).
4. Manual (device): Videos → toggle For-You during loading (skeleton, no banner); open a journal entry (skeleton editor); switch Daily Log months (previous list stays + refreshing cue); journal editor with keyboard on Android (no squash).

## Files touched (Phase G)
- `services/queries/safety.ts`, `services/queries/family.ts`, `services/queries/pregnancy.ts`
- `screens/wellness/JournalEntryScreen.tsx`
- `screens/profile/DailyLogScreen.tsx`
- `screens/wellness/JournalListScreen.tsx`, `MoodHistoryScreen.tsx`, `InsightsScreen.tsx`, `BreathingListScreen.tsx`
- `screens/wellness/VideoLibraryScreen.tsx`
- `components/ui/Loader.tsx` (label/skeleton variants or new `ScreenSkeleton.tsx`)
- `components/ui/index.ts`
- `components/ui/LazyScreen.tsx`
- `components/ui/KeyboardAvoidingWrapper.tsx`
- `components/ui/ScreenLayout.tsx`
- `components/ui/Button.tsx`, `components/ui/wellness/BreathingExerciseCard.tsx`
- `app.json` (keyboard layout mode, if changed)