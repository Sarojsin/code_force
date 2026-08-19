# Phase A — P0: List Jank & React.memo Defeats

> **Source audit:** `current_condition_ofapp/08_017_2026.md` §1.1, §1.2, §2.1, §2.2, §9.1–9.5
> **Scope:** JS-thread rendering cost of scrollable lists + memoization defeats.
> **Gate:** `npm run typecheck && npm run lint && npm run test` must stay green.

---

## A.1 `VideoLibraryScreen` — zero-perf FlatList over 100 items

**File:** `mobile/src/screens/wellness/VideoLibraryScreen.tsx`

Findings (verified):
- FlatList at `:161-176` has **none** of `windowSize`, `maxToRenderPerBatch`, `removeClippedSubviews`, `getItemLayout`, `initialNumToRender`.
- `ContentCard` is a plain function at `:330` — not `React.memo`'d.
- `renderItem` is an inline arrow (`:164-170`) — recreated every render.
- `RecommendedSection` (`:229`) and `RecommendedCard` (`:265`) are not memoized; carousel `contents.map(...)` at `:257-259` uses inline `onPress={() => onPress(item.id)}`.
- Category chips (`:126-147`) use inline `onPress` per render.

Changes:
1. Add perf props to the FlatList: `windowSize={10}`, `maxToRenderPerBatch={10}`, `removeClippedSubviews={true}`, `initialNumToRender={7}`.
2. Wrap `ContentCard` in `React.memo`. Change its `onPress` prop type to `(id: string) => void` and call `onPress(content.id)` internally so the parent passes a stable `handleOpenContent` instead of a fresh arrow per item.
3. Hoist `renderItem` to a `useCallback` bound to `[handleOpenContent, theme]`.
4. Memoize `RecommendedSection` (`React.memo`) and `RecommendedCard`; pass stable `onPress={(id) => onPress(id)}` hoisted via `useCallback` in `RecommendedSection`, and give `RecommendedCard` a plain `onPress: () => void` fed by a memoized closure in the section.
5. Category chips: replace inline `onPress` with a `useCallback` `setActiveCategory(cat)` (same reference for all chips; identity of the callback doesn't need to differ per category).
6. `ContentCard` internal `useTheme()` is already via `theme` prop; keep `theme` prop (stable object from context) — do NOT drop it from the memo deps risk: theme object identity must be stable (verify `useTheme` memoizes; if not, memo on `theme.colors` is not possible — accept `theme` identity).
7. Add `getItemLayout` only if card heights are fixed — they are **not** (thumbnail 160 + body varies). **Skip `getItemLayout`** for this list; note in code comment.

**Acceptance:** list scrolls without re-rendering off-screen `ContentCard`s; a single `setActiveCategory` does not re-render the list items; typecheck/lint green.

---

## A.2 All 4 Diary screens — FlatList with zero perf props

**Files:**
- `mobile/src/screens/diary/DiaryLibraryScreen.tsx` (FlatList `:45-64`)
- `mobile/src/screens/diary/DiaryScreen.tsx` (FlatList `:18-44`)
- `mobile/src/screens/diary/DiaryTimelineScreen.tsx` (FlatList `:34-46`)
- `mobile/src/screens/diary/DiarySearchScreen.tsx` (FlatList `:45-59`)

Findings (verified): all use plain `FlatList`, inline `renderItem`, no memoized item components, queries in `mobile/src/services/queries/diary.ts` have **no `staleTime`** (refetch on every mount/focus) and diary list is unpaginated.

Changes:
1. **`queries/diary.ts`:**
   - `useDiaries` → add `staleTime: 5 * 60_000`.
   - `useDiaryPages` → add `staleTime: 5 * 60_000`.
   - `useDiaryTimeline` → add `staleTime: 5 * 60_000`.
   - `useDiarySearch` → add `staleTime: 60_000` (server search, still debounced client-side).
   - `useDiaryPage` / `useDiary` (detail) → `staleTime: 5 * 60_000`.
2. **`DiaryLibraryScreen`:** add `windowSize`, `maxToRenderPerBatch`, `removeClippedSubviews`, `initialNumToRender`. Extract a memoized `DiaryCard` wrapper (`components/DiaryCard.tsx` already exists — verify it accepts `onPress`; make it `React.memo` if not). Hoist `renderItem` to `useCallback`; pass `navigation.navigate` wrapper via `useCallback`.
3. **`DiaryScreen`:** same perf props on the 2-column grid; extract memoized `PageCard` component; `useCallback` renderItem; `numColumns` grid → note `getItemLayout` is invalid for 2-col, skip.
4. **`DiaryTimelineScreen`:** same perf props; extract memoized `TimelineEntryCard`.
5. **`DiarySearchScreen`:** same perf props; extract memoized `SearchResultCard`.

**Acceptance:** diary screens no longer refetch on every focus; item components render only when on-screen.

---

## A.3 `DailyLogScreen` — FlatList + non-memoized `DayCard`

**File:** `mobile/src/screens/profile/DailyLogScreen.tsx`

Findings (verified): `FlatList` at `:185-191` with zero perf props; `DayCard` (`:29`) not memoized; inline `renderItem` (`:188`).

Changes:
1. Add `windowSize={10}`, `maxToRenderPerBatch={10}`, `removeClippedSubviews={true}`, `initialNumToRender={7}`.
2. `React.memo` the `DayCard` component (defined at module scope — already is; add `React.memo` wrapper).
3. Hoist `renderItem` to `useCallback` with deps `[theme]`; `DayCard` takes stable `theme` + `day`.

**Acceptance:** paging between months does not re-render already-mounted cards.

---

## A.4 Fix `React.memo` defeats (inline closures)

### A.4.1 `JournalListScreen.tsx:103` (verified `:102-104`)
`renderItem` is `useCallback`'d but passes `onPress={() => handleEntryPress(item.id)}` inline — new closure per item defeats `JournalItem`'s `React.memo` (`:34`).
- **Fix:** change `JournalItem`'s prop to `onPress: (id: string) => void` and call `onPress(item.id)` inside. `renderItem` then passes the stable `handleEntryPress` directly.

### A.4.2 `EmergencyContactsScreen.tsx:86-87` (verified pattern in audit; re-check after reading file)
Inline closures inside a `useCallback`'d `renderItem` defeat `ContactCard`'s memo.
- **Fix:** `ContactCard` takes `onPress: (contact) => void` or `onPress: () => void` with the item bound via `useCallback` factory keyed by id. Prefer `onPress(id)` pattern to keep `renderItem` reference stable.

### A.4.3 `LogPeriodScreen.tsx` chips (`:115,122,129`)
`Chip` is `React.memo`'d but every `onPress` is an inline arrow → memo defeated; all 8+8 chips re-render per toggle.
- **Fix:** pass `onPress: (value) => void` to `Chip` and call `onPress(value)` internally; hoist the handlers with `useCallback`.

### A.4.4 `HomeDashboardScreen.tsx` inline handlers (`:151,163,171,201,318,331,364`)
No `useCallback` at all on the screen. Handlers: `refetch`, `navigation.navigate('SOSActive')`, `navigate('Profile')`, `navigate(... LogPeriod)`, `navigate('JournalEntry')`, diary-bento `onPress` with `Alert`, `navigate('Videos')`.
- **Fix:** wrap each in `useCallback`. The diary-bento handler (`:331-344`) needs `diaryAssetStatus` in deps. Note: this is Phase C scope too (component split); here just stabilize the handlers that feed `AnimatedSection` (which is `React.memo`'d but defeated by inline children — children split is Phase C A.11/C.1).

**Acceptance:** toggling one chip/one favorite no longer re-renders all sibling items.

---

## A.5 Delete confirmed-dead hook

**File:** `mobile/src/hooks/useTodayDayData.ts` — verified dead (only referenced in a comment at `useTodayRecommendation.ts:37`).
- **Fix:** delete the file; remove the stale comment sentence in `useTodayRecommendation.ts`.

---

## Verification for Phase A
1. `npm run typecheck` — clean.
2. `npm run lint` — clean (watch for new `react-hooks/exhaustive-deps` warnings).
3. `npm run test` — all existing tests pass.
4. Manual smoke (device): open Videos, Diary, DailyLog, Journal; toggle category / phase chips; confirm smooth scroll.

## Files touched (Phase A)
- `screens/wellness/VideoLibraryScreen.tsx`
- `screens/diary/DiaryLibraryScreen.tsx`
- `screens/diary/DiaryScreen.tsx`
- `screens/diary/DiaryTimelineScreen.tsx`
- `screens/diary/DiarySearchScreen.tsx`
- `screens/diary/components/DiaryCard.tsx` (verify/memoize)
- `screens/profile/DailyLogScreen.tsx`
- `screens/wellness/JournalListScreen.tsx`
- `screens/safety/EmergencyContactsScreen.tsx`
- `screens/cycle/LogPeriodScreen.tsx`
- `screens/home/HomeDashboardScreen.tsx` (handler stabilization only)
- `services/queries/diary.ts`
- `hooks/useTodayDayData.ts` (delete)
- `hooks/useTodayRecommendation.ts` (comment cleanup)
