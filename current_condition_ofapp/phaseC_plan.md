# Phase C — P1: Render-Heavy Screens (Settings, Calendar, Home)

> **Source audit:** `current_condition_ofapp/08_017_2026.md` §1.4, §2.3, §9.1, §9.2
> **Scope:** reduce re-render scope of the three heaviest screens; fix functional bugs found in Settings.
> **Gate:** `npm run typecheck && npm run lint && npm run test` must stay green.

---

## C.1 `SettingsScreen` (646 lines) — memo + debounce + functional bugs

**File:** `mobile/src/screens/profile/SettingsScreen.tsx`

Findings (verified):
- Single `ScrollView` with 30 `SettingRow`s (`:302-494`); `SettingRow` (`:49-86`) not `React.memo`'d; every toggle re-renders the whole screen.
- Speech sliders `:412,422`: `onValueChange` → `setSpeechPref` → **SQLite `upsertMetadata` + 5-slice store set per drag tick, no debounce** (companionStore.ts:304-326).
- Conditional `Luna3D` GLB mount when companion installed (`:360-367`) — fs stat + model load inside Settings.
- **Functional bugs (non-perf):**
  1. 3 rows share `pushNotifications` key (`:303-305`).
  2. Dark-mode toggle is **inert** — flips local `settings` state only; theme never changes (`:320`).
  3. Hero hardcodes "Sofia Adeyemi" / "sofia@shecare.app" (`:290-291`) instead of `authStore`.
  4. `SETTING_ICONS['DarkMode']` key never matches label `'Dark Mode'` (`:45` vs `:320`).
  5. No-op rows `onPress={() => {}}`: Export My Data (`:315`), Language (`:321`), Manage Downloads (`:341`), Clear Model Cache (`:342`), Help Center (`:486`), Rate the App (`:487`), Privacy Policy (`:492`), Terms (`:493`).
  6. `EditProfileScreen` / `ChangePasswordScreen` / `Delete Account` submits are stubs (Phase E scope — listed here for context).

Changes:
1. **Memoize `SettingRow`:** wrap in `React.memo`; ensure all props are stable references. `onToggle`/`onPress` must be stable — created with `useCallback` in the parent. The `SETTING_ICONS[label]` lookup stays inside the memoized component (pure).
2. **Memoize `SpeechSliderRow`** similarly.
3. **Debounce speech sliders:** 
   - Add local component state `speechRateDraft` / `speechPitchDraft` seeded from store.
   - `onValueChange` updates **local state only** (re-renders just the slider row if the slider is its own memoized component).
   - `onSlidingComplete` commits to `setSpeechPref` once (single SQLite write + store set).
   - This removes the per-tick DB write and the 30-row re-render per tick.
4. **Fix shared `pushNotifications` key:** separate keys: `pushNotifications`, `periodReminders`, `lunaInsights` in the `settings` state; keep persistence in `AsyncStorage`/encrypted storage via a small settings store or existing mechanism (check if `settings` is persisted anywhere — currently it is not; add persistence to `user_preferences` encrypted key to actually make toggles stick).
5. **Fix dark-mode toggle:** call the theme store's toggle. Verify `ThemeProvider` (`src/theme`) exposes a setter (e.g. `useTheme()` returns `isDark`, `setDark`). Wire `toggle('darkMode')` → `setDark(value)`. If `ThemeProvider` is static, Phase C adds a minimal `setDark` (context state) — see theme files.
6. **Hero from authStore:** replace hardcoded strings with `useAuthStore((s) => s.user)`; avatar letter = first initial of `display_name ?? email`; email = `user.email`.
7. **Icon key fix:** change label usage to a stable `iconKey` prop (`label === 'Dark Mode'` → icon key `'DarkMode'`), or change `SETTING_ICONS` lookup to `SETTING_ICONS[iconKey]` with each row passing an explicit `iconKey`. Prefer explicit `iconKey` prop.
8. **No-op rows:** give them real behavior or hide them:
   - Export My Data → deep-link/placeholder that shows a "coming soon" toast (or wire to a future endpoint; for now show Toast "Not available yet").
   - Language → toast.
   - Manage Downloads → navigate to a downloads list (or toast).
   - Clear Model Cache → actually call the model-cache clear (`assetDownloader`/`globalModel` clear function if it exists) with confirmation.
   - Help Center / Rate the App / Privacy / Terms → open URLs (use `expo-intent-launcher`/`Linking`) or toast if URLs aren't defined yet.
   - Keep them **disabled-looking** (opacity) if no action exists rather than a silent no-op.
9. **Luna3D block** (`:360-367`): gate the mount on `companionReduceAnimations === false` (it already is `!companionHidden`); add `React.lazy` for `Luna3D` (Phase B helper) so Settings doesn't pull the Filament runtime eagerly. Optional Phase C if lazy list is done.

**Files touched:** `screens/profile/SettingsScreen.tsx`, `stores/companionStore.ts` (no change needed — debounce lives in screen), `theme/*` (setDark if missing), possibly a small `settingsStore` or reuse `user_preferences`.

**Acceptance:** dragging a speech slider writes to DB once on release; toggling any setting re-renders only that row; hero shows real user; dark mode actually flips theme.

---

## C.2 Calendar re-render — memoize props + cheaper cells

**Files:**
- `mobile/src/screens/calendar/CalendarScreen.tsx`
- `mobile/src/components/ui/Calendar.tsx`

Findings (verified):
- `CalendarScreen` passes inline `phaseAccentForDate={(dateStr) => getPhaseAccent(encodedDays, dateStr)}` (`:268`) and non-memoized `handleDateSelect` (`:189`) → defeats `Calendar`'s `React.memo` (`Calendar.tsx:65`) AND the `dayGrid` `useMemo` deps (`:173`) → full 42-cell grid rebuilt on every parent render.
- `cycleDay`/`currentPhase`/`selectedPhase` recomputed every render (`CalendarScreen.tsx:115-120`); `computeCycleDay` is O(n log n) (`cyclePhases.ts:109-141`).
- 42 `AnimatingWrapper` `Animated.View`s always mounted (`Calendar.tsx:125,261-267`); skeleton adds ~35 more `SkeletonDayCell`s with per-cell `withSpring` (`:248-259`).
- `useCycleDays(undefined)` on mount reads ALL local day rows (no range) and every date tap creates a new cache key (`CalendarScreen.tsx:122-126`; `cycle.ts:523`).

Changes:
1. **`CalendarScreen`:**
   - Wrap `handleDateSelect` in `useCallback([setSelectedDate, ...])`.
   - Wrap `phaseAccentForDate` prop in `useCallback((dateStr) => getPhaseAccent(encodedDays, dateStr), [encodedDays])`.
   - Wrap `cycleDay`, `currentPhase`, `selectedPhase`, `selectedStr` in `useMemo` deps `[calData, selectedDate, today]`.
   - Guard the `useCycleDays` mount call: only fetch when a date is selected → `enabled: !!selectedDate` and drop the `undefined` range call (remove the always-on full-history read). Also bound the local read to a 1-day window (already is start=end=date when selected).
2. **`Calendar.tsx`:**
   - Memoize `dayGrid` — already `useMemo`; the fix is that its deps (`phaseAccentForDate`, `onDateSelect`) become stable, so it recomputes only when `encodedDays`/month/selection change.
   - `AnimatingWrapper`: render a **plain `View`** when `!animating` (i.e. conditionally mount the `Animated.View` only when a date is animating). This removes 42 always-mounted `useAnimatedStyle` hooks.
   - `SkeletonDayCell`: keep the spring, but memoize `LoadingSkeleton` so it only mounts when `isLoading` (it already only renders when loading). Optionally remove per-cell delay to reduce first-paint work.
   - Keep `React.memo` on `Calendar`; ensure `markedDates`/`dimmedDates`/`encodedDays` references stay stable across unrelated parent renders (CalendarScreen should `useMemo` them — `encodedDays` already is).

**Files touched:** `screens/calendar/CalendarScreen.tsx`, `components/ui/Calendar.tsx`.

**Acceptance:** selecting a date or toggling a phase filter no longer rebuilds all 42 cells; opening the day sheet doesn't recompute the grid.

---

## C.3 Split `HomeDashboardScreen` — memoized sections + `AnimatedSection` fix

**File:** `mobile/src/screens/home/HomeDashboardScreen.tsx`

Findings (verified):
- Monolithic ~270-line `ScrollView` (`:137-379`). Full screen re-renders on `cycleDay` change (`useCurrentCycleState(3,3)`) and speech-bubble state (`useSyncExternalStore` on EventEngine).
- `AnimatedSection` IS memoized (`AnimatedSection.tsx:10`) but always given **inline JSX children** (`:188,211,275`, etc.) → memo defeated.
- No `useCallback` for any handler (`:151,163,171,201,318,331,364`).

Changes:
1. **Extract memoized section components** into `mobile/src/components/home/` (there is already `CheckInCard.tsx`, `CatchUpCard.tsx`, `HomeRecommendationBanner.tsx`):
   - `HomeHeader` (greeting + SOS + avatar buttons) — props: `todayStr`, `firstName`, `onSos`, `onProfile`.
   - `CycleHeroCard` (the LinearGradient hero, ring, stats) — props: `cycleDay`, `phaseName`, `phaseEmoji`, `phaseDesc`, `phaseColor`, `nextPeriodDays`, `predictedCycleLength`.
   - `EmptyCycleCard` — props: `onLogPeriod`.
   - `PhaseTimeline` (horizontal phase cards) — props: `phaseKey`.
   - `BentoGrid` (journal / diary / videos cards) — props: `diaryAssetStatus`, `onJournal`, `onDiary`, `onVideos`.
   - Each wrapped in `React.memo` with **stable** handler props from `useCallback` in the parent.
2. **Fix `AnimatedSection` inline-children defeat:** the section component itself must be the child: `<AnimatedSection delay={...}><CycleHeroCard .../></AnimatedSection>` where `CycleHeroCard` is memoized. The `delay` prop is stable. `AnimatedSection` memo then holds as long as the child element reference is stable — since `CycleHeroCard` is memoized, its element reference only changes when props change.
3. **Stabilize handlers:** `useCallback` for `onSos`/`onProfile`/`onLogPeriod`/`onJournal`/`onDiary`/`onVideos`/`refetch`. The diary handler uses `diaryAssetStatus` in deps.
4. Keep `LunaOverlay` mount gating as-is (`:380`, `isFocused && lunaEnabled`) — Phase E adds the AppState pause.

**Files touched:** `screens/home/HomeDashboardScreen.tsx`, new `components/home/*` section components, `components/ui/AnimatedSection.tsx` (verify it uses React.memo + stable children contract).

**Acceptance:** a speech-bubble update (EventEngine) re-renders only the overlay, not the whole dashboard; `cycleDay` change re-renders only the hero/timeline sections that depend on it.

---

## Verification for Phase C
1. `npm run typecheck && npm run lint && npm run test`.
2. Manual: toggle settings rows; drag speech slider (confirm single DB write via `pruneLocalDb`/log); switch dark mode; open Calendar and tap dates/phases; watch Home re-renders in React DevTools (off).

## Files touched (Phase C)
- `screens/profile/SettingsScreen.tsx`
- `screens/calendar/CalendarScreen.tsx`
- `components/ui/Calendar.tsx`
- `screens/home/HomeDashboardScreen.tsx`
- `components/home/*` (new section components)
- `theme/*` (setDark if missing)
- possibly new `stores/settingsStore.ts` for persisted toggles
