# Phase I — P2: Error/Empty States, Calendar Accessibility, Density & Typography

> **Source audit:** `current_condition_ofapp/08_19_2026.md` §3.1–3.5, §4.2(complete), §4.4, §5.4, PART 6 items #7(partial), #9, #10
> **Scope:** wire the dead `ErrorState` component everywhere, add non-color phase glyphs to the calendar, reduce visual density + typography tiers, fix floating-overlap and small hit targets.
> **Gate:** `npm run typecheck && npm run lint && npm run test` must stay green.

---

## Already done (context — do not redo)
- Calendar re-render: `CalendarScreen.tsx:223` `phaseAccentForDate` is `useCallback`'d; grid is `useMemo`; **day cells are already 46×46 pt** (`Calendar.tsx:280-285`); `hitSlop={8}` on arrows (Calendar.tsx:185,198). (Phase C.2 complete.)
- Home split into memoized sections + `AnimatedSection` fix + Luna AppState pause (Phase C.3 + E.4 complete).
- Settings functional bugs (hero from authStore, shared `pushNotifications` key, dark-mode toggle, no-op rows, speech-slider debounce, memoized rows) — Phase C.1 complete.
- FlatLists perf (Diary/Videos/DailyLog/Journal) — Phase A complete.

---

## I.1 Wire the dead `ErrorState` component + differentiate empty/loading/error

**Verified:** `components/ui/ErrorState.tsx` exists (`message`, `onRetry`, `isOffline` props) but has **0 imports** anywhere (dead component). `isError` handling currently exists only in: CyclePredictions, ContentDetail, JournalList, MoodHistory, VideoLibrary. Most async screens silently render empty/blank on network failure (audit §5.4).

**Changes:**
1. Add `ErrorState` (message + Retry wired to `refetch`) to the async screens missing an error branch:
   - `JournalEntryScreen` (entry load failure)
   - `DailyLogScreen` (day fetch failure)
   - `InsightsScreen`
   - `BreathingListScreen`
   - diary screens: `DiaryLibraryScreen`, `DiaryScreen`, `DiaryTimelineScreen`, `DiarySearchScreen`
   - `WellnessHomeScreen` (any section query error)
   - `PregnancyHomeScreen`, `PregnancyMilestonesScreen` (queries with no isError today)
2. Standardize the three-way differentiation per screen: **loading** → `ScreenSkeleton` (G.2); **error** → `ErrorState` + retry; **empty** → `EmptyState` (used today only in DailyLog/ContentDetail/VideoLibrary). Extend `EmptyState` to take an optional `actionLabel` where a re-navigation helps.
3. Delete or keep the component? Keep `ErrorState.tsx` — it is now the single shared implementation.

**Acceptance:** grepping `isError` shows an error branch in every async screen; `ErrorState` has ≥ 10 import sites.

---

## I.2 Calendar — non-color phase glyphs inside cells

**File:** `components/ui/Calendar.tsx` `renderDay` (`:108-167`), phase accent from `phaseAccentForDate` (`:108`)

Verified: phase is encoded **only** by background/text color (`typeColor`, `selectedBg = phaseAccent`). Cells show the day number, "Today" tag, marked dot — no non-color cue (audit §3.3; a11y labels already exist `:129-130`).

**Changes:**
1. Pass phase **glyph** through the existing `phaseAccentForDate` pipe: give `CalendarScreen`/`Calendar` an optional `phaseGlyphForDate?: (dateStr) => string | undefined` returning a **letter** (first letter of the phase: `P`/`F`/`O`/`L` — matches the `letters` arrays already in `CalendarScreen.tsx:45-49`). Simplest: extend the existing per-phase meta so the cell renders `{letter}` beneath the day number at ~8–9 pt.
2. Render the glyph inside the cell (below day number) when present, **always same color contrast** (theme `textDark` with opacity), independent of the phase tint — sighted non-colorblind users get a text cue, color stays secondary.
3. Add the relative glyph to the `accessibilityLabel` (``${dateStr}, ${dayType}, ${phaseLetter}``) so TalkBack/VoiceOver announce it — keep the existing role/state.
4. Do NOT touch the memoization (grid `useMemo` deps at `Calendar.tsx:173` must include the new function — `useCallback` it in `CalendarScreen` like `phaseAccentForDate`).

**Acceptance:** phase is legible with color vision deficiency (grayscale screenshot still shows P/F/O/L letters); grid memo still holds (no full rebuild on unrelated updates).

---

## I.3 Typography tiers in `theme/` + promote decision-relevant captions

**Verified literals (audit §3.4):**
- `AnalyticsDashboardScreen.tsx:124,135` — `fontSize 9` chart labels (secondary tier, okay once named).
- `VideoLibraryScreen.tsx:175` — `variant="caption" color="muted"` for decision-relevant info ("Browse all videos" browse-note + content descriptions).
- `SettingsScreen.tsx:669,674,687` and `ProfileHomeScreen.tsx:174,179` — inline `fontSize 10/12/13/21` literals.
- `CalendarScreen` phase pills / next-period dates use small muted captions (`:471`, `Calendar.tsx:296` 7pt "Today" tag).

**Changes:**
1. Extend `theme/typography` (or `theme/index.ts`) with a named tier set: `title / body / caption / annotation` + numeric sizes + line-heights. Map existing `Text` `variant`s onto the tiers so the naming is canonical (verify current `Text.tsx` variant list first).
2. Promote decision-relevant text from `caption/muted` → `body` (or a new `bodySmall` tier): phase names in the legend, "next period" dates, confirm-by dates in DailyLog/backfill cards, the Videos browse-note.
3. Replace the inline `fontSize:` literals in Settings/ProfileHome/Calendar with tier tokens (no behavior change — pure remap).
4. Reduce the `Today` tag from 7 pt (`Calendar.tsx:296`) to a tier size ≥ 9 pt for readability.

**Acceptance:** no `fontSize: 9`-style literals in screens; decision-relevant text meets ≥ `bodySmall` contrast/size; dark mode unaffected.

---

## I.4 Density — legend pills + phase cards + cycle dashboard

**Files:** `screens/calendar/CalendarScreen.tsx`, `screens/cycle/CycleDashboardScreen.tsx`

**Changes:**
1. Legend (`CalendarScreen.tsx:267-289`): reduce to **icon + text pairs** (emoji + short label, icons already at `:45-49`), remove the solo-text pills; bump pill height to ≥ 36 pt and keep `hitSlop`.
2. Phase overview cards (`:337-402`): collapse the 5 cards into one **collapsible** card (or a 2×3 compact grid) using the 4 px-grid tokens — audit §3.1 wants fewer stacked full-width cards.
3. `CycleDashboardScreen`: keep backfill/banner cards but move the phase timeline into the collapsible pattern; confirm spacing uses `theme.spacing` tokens (no literals).
4. `Calendar.tsx:279` `weekRow` space-evenly stays; verify on a 360 pt device that 7 columns keep cells ≥ 44 pt effective width (46 covers it).

**Acceptance:** the cycle/calendar screen has an obvious hierarchy (legend → calendar → collapsible phases) instead of 5 stacked full cards.

---

## I.5 hitSlop / touch targets (≥ 44×44)

**Verified:** cells are 46 pt (`Calendar.tsx:280`), arrows have `hitSlop={8}` (`Calendar.tsx:185,198`), but **Settings rows/icons and legend pills have no `hitSlop`** (audit §3.2).

**Changes:**
1. `SettingsScreen` rows (`SettingRow` + icon area): add `hitSlop={8}`; ensure row height ≥ 44 (verify current row padding; add `minHeight: 44`).
2. Legend pills (`CalendarScreen.tsx:278`) + phase pills: `hitSlop={8}`.
3. Sweep greps `hitSlop` — add to any interactive element whose visual box is < 44 pt unless it already has `accessibilityRole` + adequate size (audit §3.2).
4. `FloatingActionButton.tsx` (see I.6) — while repositioning, confirm its touch target ≥ 44.

**Acceptance:** every tappable below 44 pt has `hitSlop` (or is enlarged); a95 audit flag silent.

---

## I.6 Floating overlap — Luna dock spacer + FAB reposition

**Files:**
- `screens/home/HomeDashboardScreen.tsx` (scroll containers for hero/bento cards)
- `screens/wellness/WellnessHomeScreen.tsx:25` (~9 stacked sections)
- `components/ui/wellness/FloatingActionButton.tsx:75-76` (`bottom: -24`)
- `LunaOverlay.tsx` (dock at `zIndex: 1000` — layout preserved)

**Changes:**
1. Reserve a bottom inset in `HomeDashboardScreen` and `WellnessHomeScreen` scroll containers (`contentContainerStyle` `paddingBottom` = tab bar height + Luna dock height) so content never sits under the floating dock (audit §3.5).
2. `FloatingActionButton`: change `bottom: -24` → a positive offset inside safe area; add optional scroll-offset hiding (hide while a `FlatList`/`ScrollView` is scrolling down, reappear on idle) to avoid covering content.
3. Confirm Luna dock (`LunaOverlay.tsx:619-622`) stays above the tab bar but no longer overlaps the last card.

**Acceptance:** scrolling the bottom of Home/Wellness reveals full content without the dock obscuring cards; FAB no longer clips at the screen edge.

---

## I.7 Long screens — collapsible sections (Settings) 

**Files:** `screens/profile/SettingsScreen.tsx` (30 rows, `:272`), `screens/analytics/AnalyticsDashboardScreen.tsx` (12-month SVG `.map`)

**Changes:**
1. Settings: group rows into collapsible sections (Account / Notifications / Companion / About) using the tint specifics already memoized (Phase C). Fold = less scroll, but do NOT change row behavior.
2. Analytics: keep the chart on ScrollView (virtualizing an SVG doesn't pay off); note in code that the 12-month list is intentionally not a `FlatList` (Phase D bounded the fetch to 6 months, reducing rows).
3. Optional: `react-native-section-list`-style or Accordion only if Settings ScrollView jank appears after I.5 changes.

**Acceptance:** Settings has 3–4 collapsible groups; no perf regression in the analytics chart screen.

---

## Verification for Phase I
1. `npm run typecheck && npm run lint && npm run test`.
2. `rg "ErrorState" src` → imported in all async screens; `rg "fontSize:\s*(9|10)\b" src/screens` → none.
3. Manual (device): calendar in grayscale/simulated CVD shows phase letters; errors: airplane-mode → open Journal/Diary/Insights (shows ErrorState + Retry, not blank); scroll bottom of Home + Wellness (dock doesn't cover cards); tap smallest targets (Settings icons, legend pills) — responsive.
4. Confirm dark mode: no layout shift after typography remap (AGENTS §2.3).

## Files touched (Phase I)
- `components/ui/ErrorState.tsx` (keep/expose), `components/ui/EmptyState.tsx` (optional `actionLabel`)
- Async screens: `JournalEntryScreen`, `DailyLogScreen`, `InsightsScreen`, `BreathingListScreen`, `DiaryLibraryScreen`, `DiaryScreen`, `DiaryTimelineScreen`, `DiarySearchScreen`, `WellnessHomeScreen`, `PregnancyHomeScreen`, `PregnancyMilestonesScreen`
- `components/ui/Calendar.tsx`, `screens/calendar/CalendarScreen.tsx`
- `theme/` (typography tiers), `components/ui/Text.tsx` (variant mapping)
- `screens/analytics/AnalyticsDashboardScreen.tsx`
- `screens/profile/SettingsScreen.tsx`, `screens/profile/ProfileHomeScreen.tsx`
- `screens/home/HomeDashboardScreen.tsx`, `screens/wellness/WellnessHomeScreen.tsx`
- `components/ui/wellness/FloatingActionButton.tsx`
- `screens/cycle/CycleDashboardScreen.tsx` (density)