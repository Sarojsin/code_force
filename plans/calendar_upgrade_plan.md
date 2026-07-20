# Calendar System Upgrade — Bikram Sambat (B.S.) / Gregorian (A.D.) Switch

> **Status:** Draft  
> **Target release:** TBD  
> **Depends on:** `@sbmdkl/nepali-date-converter` npm package  

---

## Overview

Add a user-facing toggle to switch the entire app between **Bikram Sambat (B.S.)** and **Gregorian (A.D.)** calendar systems. The toggle lives on the home screen and affects all date displays, the calendar grid, and date-picker inputs across every tab and screen.

### Design principle

The calendar switch is a **display-layer** feature. All backend dates stay in Gregorian (ISO 8601). Conversion happens client-side:

- **Display:** AD → BS (via `@sbmdkl/nepali-date-converter`)  
- **Input:** BS → AD before sending to API  
- **All internal math** (cycle length, predictions, ovulation windows) remains in Gregorian — these are elapsed-day calculations, not calendar-system-dependent.

### UX decisions (confirmed by product)

| Decision | Choice |
|----------|--------|
| Date input handling | Full BS input — pickers show BS dates, convert to AD before API |
| Conversion library | npm package — `@sbmdkl/nepali-date-converter` (0 deps, TS types, 1921–2040 AD range) |
| Display style | Show **both** BS and AD (e.g. *"Shrawan 15, 2081 \| July 30, 2024"*) |
| Month name language | English transliteration (Baisakh, Jestha, Ashadh, …) |

---

## Conversion Library

### `@sbmdkl/nepali-date-converter` v2.0.5

- 0 runtime dependencies
- Built-in TypeScript declarations
- Methods: `adToBs('YYYY-MM-DD')`, `bsToAd('YYYY-MM-DD')`
- Date range: 1921 AD – 2040 AD (1978 BS – 2099 BS)
- MIT license
- Weekly downloads: ~740

```ts
import { adToBs, bsToAd } from '@sbmdkl/nepali-date-converter';

const bs = adToBs('2024-07-30');
// { year: 2081, month: 4, day: 15, ... }

const ad = bsToAd('2081-04-15');
// { year: 2024, month: 6, day: 30 }  (0-indexed month — verify with package docs)
```

---

## Implementation Phases

### Phase 1 — Foundation (`mobile/src/utils/calendar/`)

#### 1.1 `calendarTypes.ts`

```ts
export type CalendarSystem = 'AD' | 'BS';

// DESIGN DECISION: BS month names are in English transliteration (Baisakh, Jestha, etc.)
// for consistency with the @sbmdkl/nepali-date-converter library and technical readability.
// Nepali script (देवनागरी) is intentionally not used — the feature is a calendar-system
// switch, not a language-localization feature. If Nepali script is needed, add it as a
// separate i18n concern in a future release.
export const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan',
  'Bhadra', 'Ashwin', 'Kartik', 'Mangsir',
  'Poush', 'Magh', 'Falgun', 'Chaitra',
] as const;

export const BS_WEEKDAYS = [
  'Aitabar', 'Sombar', 'Mangalbar', 'Budhabar',
  'Bihibar', 'Shukrabar', 'Sanibar',
] as const;

export type BsDate = {
  year: number;
  month: number;   // 1-indexed
  day: number;
  monthName: string;
  dayOfWeek: number;
};
```

#### 1.2 `bsDateUtils.ts`

Wrappers around `@sbmdkl/nepali-date-converter` with error handling and consistent types.

```ts
import { adToBs, bsToAd } from '@sbmdkl/nepali-date-converter';
import type { BsDate } from './calendarTypes';
import { BS_MONTHS } from './calendarTypes';

/** Convert a JS Date (AD) to a structured BsDate object. Returns null if out of range. */
export function adToBsDate(adDate: Date): BsDate | null;

/** Convert BS year/month/day to a JS Date (AD). Returns null if out of range. */
export function bsToAdDate(year: number, month: number, day: number): Date | null;
```

**Edge cases — CRITICAL:**

- **Out-of-range dates (AD < 1921 or AD > 2040):** The underlying library throws. Wrap `adToBs()` and `bsToAd()` in try/catch. Return `null` instead of throwing.
- **UI fallback for null:** `formatDisplayDate()` — if the BS conversion returns `null`, display the AD date with a muted indicator: *"BS not available for this date"* (e.g. `"July 30, 1990 ⓘ"`).
- **Why this matters:** A user born in 1960 logging a cycle in 1990 would see a crash without this guard. The conversion library covers 1921–2040 AD, so dates before/after that range must be gracefully handled.

#### 1.3 `formatDate.ts`

Central date-formatting function used across all screens. This is the single point where the calendar system is applied.

```ts
import type { CalendarSystem } from './calendarTypes';

/** Display a date according to the active calendar system. */
export function formatDisplayDate(
  adDate: Date,
  calendar: CalendarSystem,
  style: 'long' | 'short' | 'day' = 'long',
): string;

/** Format a month+year header (used in calendar navigation). */
export function formatMonthYear(
  adDate: Date,
  calendar: CalendarSystem,
): string;

/** Unified ISO string helper (replaces 6+ duplicates across the codebase). */
export function toDateStr(date: Date): string;

/** Unified addDays helper (replaces 3+ duplicates). */
export { addDays } from 'date-fns';
```

**Example outputs:**

| Input | AD mode | BS mode |
|-------|---------|---------|
| `formatDisplayDate(date, 'long')` | "July 30, 2024" | "Shrawan 15, 2081 \| July 30, 2024" |
| `formatDisplayDate(date, 'short')` | "Jul 30, 2024" | "Shrawan 15 \| Jul 30" |
| `formatDisplayDate(date, 'day')` | "30" | "15" |
| `formatMonthYear(date)` | "July 2024" | "Shrawan 2081 \| July 2024" |

#### 1.4 Barrel export

```ts
// mobile/src/utils/calendar/index.ts
export * from './calendarTypes';
export * from './bsDateUtils';
export * from './formatDate';
```

---

### Phase 2 — State & Toggle

#### 2.1 `useCalendarSystemStore` (`mobile/src/stores/calendarSystemStore.ts`)

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CalendarSystem } from 'src/utils/calendar';

interface CalendarSystemState {
  calendarSystem: CalendarSystem;
  toggle: () => void;
  set: (system: CalendarSystem) => void;
}

export const useCalendarSystemStore = create<CalendarSystemState>()(
  persist(
    (set) => ({
      calendarSystem: 'AD',
      toggle: () => set((s) => ({
        calendarSystem: s.calendarSystem === 'AD' ? 'BS' : 'AD',
      })),
      set: (calendarSystem) => set({ calendarSystem }),
    }),
    {
      name: 'shecare.calendarSystem',
      storage: createEncryptedStorageAdapter(),
    },
  ),
);
```

Uses the same encrypted-storage persistence pattern as other stores (per frontend rule §2.13).

#### 2.2 Home screen toggle (`mobile/src/screens/home/HomeDashboardScreen.tsx`)

Add a `Pressable` chip/badge showing the active calendar system.

**Placement:** In the screen header area, aligned right (e.g., next to the notification bell or 🌸 logo).

**Visuals:**

```
┌──────────────────────────────────┐
│  🌸 SheCare              [AD|BS] │
│  Good morning, User              │
│  Next period in 5 days...        │
└──────────────────────────────────┘
```

- Chip shows `"AD"` or `"BS"` 
- Tapping toggles between systems
- Subtle background color change to indicate active state
- Accessibility: `accessibilityLabel="Switch to BS calendar"` / `accessibilityRole="button"`

---

### Phase 3 — Calendar Grid

#### 3.1 Shared `Calendar` component (`mobile/src/components/ui/Calendar.tsx`)

**Month/Year header:**
```
<Text>
  {formatMonthYear(currentMonth, calendarSystem)}
</Text>
```

AD mode → `"July 2024"`  
BS mode → `"Shrawan 2081 | July 2024"`

**Day cells:**

In BS mode, each day cell shows:

```
┌─────┐
│ १५  │   ← BS day number (using formatDisplayDate(day, 'BS', 'day'))
│ 30  │   ← AD day number (smaller, muted)
└─────┘
```

In AD mode, show only the AD day number (existing behavior, unchanged).

**Phase dots / type indicators** (P, F, O, L, p, f, etc.): Unchanged — these are phase markers, not dates.

**🟡 Performance optimization — memoize BS conversion for the month:**

The calendar grid renders up to 42 day cells. In BS mode, each cell calls `adToBsDate()` + `formatDisplayDate()`. While the library is lightweight (embedded lookup table, no I/O), it's still 42+ function calls per render. Memoize at the month level:

```ts
const bsDaysMap = useMemo(() => {
  if (calendarSystem !== 'BS') return null;
  const result: Record<string, { bsDay: number; adDay: number }> = {};
  for (const dateStr of daysInMonth) {
    const bs = adToBsDate(new Date(dateStr));
    result[dateStr] = { bsDay: bs?.day ?? 0, adDay: new Date(dateStr).getDate() };
  }
  return result;
}, [currentMonth, calendarSystem]);
```

Then in the render loop: `const { bsDay, adDay } = bsDaysMap[dateStr] ?? {};`  
This avoids redundant `adToBsDate()` calls on every render cycle.

#### 3.2 `CalendarScreen` (`mobile/src/screens/calendar/CalendarScreen.tsx`)

- Month navigation (prev/next) — no change. Navigation stays in AD months internally. On month change, the grid header shows BS month name via `formatMonthYear`.
- Selected date bottom sheet title → use `formatDisplayDate(selectedDate, calendarSystem, 'long')`
- "Today" button → no change (still uses `new Date()` internally)

#### 3.3 Day details BottomSheet

Title in BS mode: `"Shrawan 15, 2081 | July 30, 2024"`  
Phase info, symptoms, quick-log → no date changes needed.

#### 3.4 🔴 Critical — Optimistic cache updates (applyPhaseToDays)

**The problem:** `useLogCorrection` onMutate in `cycle.ts` immediately updates the calendar cache using `calculateCyclePhases()` and `applyPhaseToDays()`. These functions exist in `utils/cyclePhases.ts` and operate on the day-type map (`Record<string, string>`) where keys are ISO date strings (`YYYY-MM-DD`).

**Why it still works:** The map keys are ISO date strings (Gregorian), which serve as internal identifiers. The calendar system switch only affects **display** of the day number inside each cell. The `Calendar.tsx` component reads the day number from the date object, not from the map. Since the map keys remain ISO and the day number is derived from the date object (converted to BS via `formatDisplayDate()`), no changes to `cyclePhases.ts` are needed.

**Verification checklist:**
- [ ] `cyclePhases.ts` — keys are ISO strings → unaffected
- [ ] `Calendar.tsx` day cell render — reads day from date object, not map value → passes through `formatDisplayDate()` → handles BS
- [ ] `CalendarScreen.tsx` day cell render — same pattern → passes through `formatDisplayDate()`

**Conclusion:** No code changes needed in the optimistic cache path.

---

### Phase 4 — DatePickerField

#### 4.1 BS mode input strategy

The native `@react-native-community/datetimepicker` only works with JS Date (Gregorian). Three options, with **Option C** recommended:

| Option | Pros | Cons |
|--------|------|------|
| **A** — Text input with conversion | Simple; works with existing layout | Poor UX for date selection |
| **B** — Use `@sbmdkl/nepali-datepicker-reactjs` | Feature-rich; built for BS | Unclear RN compatibility; extra dependency; may not match theme |
| **C** — 3-dropdown picker (Year/Month/Day) | Works offline; full control; good UX; no extra dependency | More code to write |

**Recommended: Option C**

When `calendarSystem === 'BS'`:
- `DatePickerField` renders 3 horizontal dropdown/picker columns: **Year** (BS) | **Month** (BS name) | **Day** (1-32)
- Pre-fills with current date converted to BS via `adToBsDate()`
- On change:
  1. Read BS year/month/day from the pickers
  2. Convert to AD via `bsToAdDate()`
  3. Call `onChange` with the AD date string (existing flow unchanged)
- A small `"BS"` badge appears next to the picker label so the user knows which system they're in

When `calendarSystem === 'AD'`:
- Existing native date picker behavior (unchanged)

**Files affected:**

| File | Change |
|------|--------|
| `components/ui/DatePickerField.tsx` | Add BS mode with 3-dropdown picker fallback |
| `components/ui/DatePickerFieldBS.tsx` (new) | Extract BS picker into sub-component for cleanliness |

---

### Phase 5 — All Date Displays (~20 locations)

Every screen that displays dates must use `formatDisplayDate()` instead of direct `toLocaleDateString()` or `date-fns format()` calls.

#### 5.1 Consolidate duplicate helpers

Before making screen changes, consolidate the 6+ copies of `toDateStr()` and 3+ copies of `addDays()`:

| Helper | # of copies | Action |
|--------|-------------|--------|
| `toDateStr(date)` | 6+ | Replace all with import from `src/utils/calendar/formatDate` |
| `addDays(date, n)` | 3+ | Replace all with `import { addDays } from 'date-fns'` |
| `date.toLocaleDateString('en-US', ...)` | ~15 | Replace with `formatDisplayDate()` |

#### 5.2 Screen-by-screen changes

| # | Screen | File | What displays dates | Change |
|---|--------|------|---------------------|--------|
| 1 | Home Dashboard | `screens/home/HomeDashboardScreen.tsx` | Next period date (line 196) | `formatDisplayDate(..., calendarSystem, 'long')` |
| 2 | Cycle Dashboard | `screens/cycle/CycleDashboardScreen.tsx` | Next period label (line 255) | `formatDisplayDate(..., calendarSystem, 'long')` |
| 3 | Prediction Detail Card | `components/ui/PredictionDetailCard.tsx` | Next start (98), period end (101) | `formatDisplayDate()` × 2 |
| 4 | Sticky Card (checkin) | `components/ui/StickyCard.tsx` | Predicted date label (51-53) | `formatDisplayDate()` |
| 5 | Cycle Predictions | `screens/cycle/CyclePredictionsScreen.tsx` | Prediction history table month/predicted/actual columns | `formatDisplayDate()` × 3 per row |
| 6 | Cycle History | `screens/cycle/CycleHistoryScreen.tsx` | Date range (line 50) | `formatDisplayDate()` |
| 7 | Analytics Dashboard | `screens/analytics/AnalyticsDashboardScreen.tsx` | Chart month labels (line 74) | `formatMonthYear()` |
| 8 | Journal List | `screens/wellness/JournalListScreen.tsx` | Journal entry date (line 46) | `formatDisplayDate()` |
| 9 | Mood History | `screens/wellness/MoodHistoryScreen.tsx` | Mood timestamp (line 39) | `formatDisplayDate()` |
| 10 | Journal Entry | `screens/wellness/JournalEntryScreen.tsx` | Draft saved time (line 66) | Keep `formatDistanceToNow` — relative time, no calendar system needed |
| 11 | SOS History | `screens/safety/SosHistoryScreen.tsx` | Alert date (line 32) | `formatDisplayDate()` |
| 12 | AI Chat | `screens/chat/AIChatScreen.tsx` | Message time (164/183/201) | Keep `toLocaleTimeString()` — time of day, not date |
| 13 | Mark End Date Modal | `components/ui/MarkEndDateModal.tsx` | Period start label (46-49) | `formatDisplayDate()` |
| 14 | End Date Prompt Card | `components/ui/EndDatePromptCard.tsx` | Start date label (29-31) | `formatDisplayDate()` |
| 15 | Menstrual Phases | `screens/cycle/MenstrualPhasesScreen.tsx` | Phase date ranges | `formatDisplayDate()` |
| 16 | Log Period | `screens/cycle/LogPeriodScreen.tsx` | Period start date display | `formatDisplayDate()` |
| 17 | CycleAnalytics | `screens/cycle/CycleAnalyticsScreen.tsx` | Stat dates | `formatDisplayDate()` |
| 18 | Pregnancy screens | `screens/pregnancy/` | Due date, LMP, week info | `formatDisplayDate()` |

#### 5.3 Screens / components that do NOT need changes

| Screen | Reason |
|--------|--------|
| `JournalEntryScreen.tsx` | `formatDistanceToNow` is relative ("2 hours ago") — no calendar system |
| `AIChatScreen.tsx` | `toLocaleTimeString` is time-of-day only |
| All `BottomSheet`, `Button`, `Text` primitives | No date rendering |
| Auth screens | No date display |
| Safety screens other than SOS history | Timestamps are for audit, not user-facing display |

---

### Phase 6 — Risk Mitigation & Edge Cases

| Risk | Mitigation |
|------|------------|
| `adToBs/bsToAd` can throw for out-of-range dates | Wrap all conversion calls in try/catch; fall back to AD display; log error |
| Performance: converting 42 day cells per render | Conversions are instant (lookup table, no I/O). Memoize with `useMemo` |
| BS date state is stale after switching mid-scroll | The store is reactive — all components re-render on toggle via Zustand subscription |
| Native date picker doesn't support BS | Option C (3-dropdown) in `DatePickerField` handles BS input |
| User logs period while in BS mode, switches to AD | The stored date is always AD; switching only changes display — no data loss |
| Offline-first consistency | The library is embedded; no API calls needed for conversion |
| Edge of date range (year 1920 or 2041+) | `adToBsDate()` throws → caught → AD fallback with warning toast: *"Date out of BS range"* |

---

## Files Summary

### New files (5)

```
mobile/src/utils/calendar/
├── calendarTypes.ts        — Types, BS month names, BsDate interface
├── bsDateUtils.ts          — adToBsDate(), bsToAdDate() wrappers
├── formatDate.ts           — formatDisplayDate(), formatMonthYear(), toDateStr()
└── index.ts                — Barrel export

mobile/src/stores/
└── calendarSystemStore.ts  — Zustand store + EncryptedStorage persistence
```

### Modified files (~25)

```
# Core UI
mobile/src/components/ui/Calendar.tsx
mobile/src/components/ui/DatePickerField.tsx
mobile/src/components/ui/PredictionDetailCard.tsx
mobile/src/components/ui/StickyCard.tsx
mobile/src/components/ui/MarkEndDateModal.tsx
mobile/src/components/ui/EndDatePromptCard.tsx

# Screens — Home
mobile/src/screens/home/HomeDashboardScreen.tsx

# Screens — Calendar tab
mobile/src/screens/calendar/CalendarScreen.tsx
mobile/src/screens/cycle/CycleDashboardScreen.tsx
mobile/src/screens/cycle/CyclePredictionsScreen.tsx
mobile/src/screens/cycle/CycleHistoryScreen.tsx
mobile/src/screens/cycle/CycleAnalyticsScreen.tsx
mobile/src/screens/cycle/MenstrualPhasesScreen.tsx
mobile/src/screens/cycle/LogPeriodScreen.tsx

# Screens — Wellness
mobile/src/screens/wellness/JournalListScreen.tsx
mobile/src/screens/wellness/MoodHistoryScreen.tsx

# Screens — Safety
mobile/src/screens/safety/SosHistoryScreen.tsx

# Screens — Analytics
mobile/src/screens/analytics/AnalyticsDashboardScreen.tsx

# Screens — Pregnancy
mobile/src/screens/pregnancy/PregnancyProfileScreen.tsx
mobile/src/screens/pregnancy/PregnancyHomeScreen.tsx

# Utilities (consolidation)
~6 files: remove local toDateStr() copies → import from utils
~3 files: remove local addDays() copies → import from date-fns
```

---

## Non-Goals (Explicitly Out of Scope)

- Changing the backend database to store BS dates
- Modifying the API contract (`plans/30-mobile-api-contract.md`)
- BS-specific notifications or check-in scheduling
- Lunar/solar phase calculations in BS
- Translating the UI into Nepali language
- Support for other calendar systems (e.g., Hijri, Chinese)

---

## API Contract

No changes. Backend continues to receive and return ISO 8601 dates (`YYYY-MM-DD`). The mobile client converts BS → AD before every API call, and AD → BS for every display.

---

## Rollback Plan

Toggle back to `'AD'` in the store. All `formatDisplayDate()` calls fall through to the `'AD'` branch and exhibit the existing pre-feature behavior without any code change. The `useCalendarSystemStore` default is `'AD'`, so fresh installs see the Gregorian calendar with no indication of BS capability.
