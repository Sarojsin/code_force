# Cycleplan 2 — Mobile Implementation (SheCare Calendar Correctness)

**Scope:** All approved mobile changes.
**Status:** Approved for implementation.
**Target files:** `mobile/src/utils/cyclePhases.ts`, `mobile/src/components/ui/Calendar.tsx`, `mobile/src/screens/calendar/CalendarScreen.tsx`, `mobile/src/utils/backfillCards.ts`, `mobile/src/hooks/useCatchUp.ts`, `mobile/src/hooks/usePeriodCheckIn.ts`, `mobile/src/utils/date.ts` (new), plus a device-local "today" sweep.

---

## Decision summary (folded in)

| ID | Decision | Where |
|----|----------|-------|
| B | `pw` prediction-window band color + Period legend filter includes it | Calendar.tsx, CalendarScreen.tsx |
| C | `Fl` / `fl` follicular colors, legend pill, day-detail phase, Phase Overview card | cyclePhases.ts, Calendar.tsx, CalendarScreen.tsx |
| F2 | `u` gets a light-pink background (dashed border stays) | Calendar.tsx |
| G3 | Backfill uses the user's real average cycle (not hardcoded 28) | backfillCards.ts, useCatchUp.ts |
| H | "Today" is device-local everywhere; new shared date helpers | utils/date.ts + sweep |

---

## B1. `utils/cyclePhases.ts` — follicular support

1. `CyclePhases` interface + `calculateCyclePhases`: add `follicularStart` / `follicularEnd`:

```ts
export function calculateCyclePhases(periodStart, cycleLength, periodLength = 5): CyclePhases {
  const ovulationOffset = Math.max(10, Math.min(cycleLength - 14, 40));
  const ovulationDate = shiftDays(periodStart, ovulationOffset);
  const fertileStart = shiftDays(ovulationDate, -4);
  return {
    periodStart,
    periodEnd: shiftDays(periodStart, periodLength - 1),
    follicularStart: shiftDays(periodStart, periodLength),       // period_end + 1
    follicularEnd: shiftDays(fertileStart, -1),                  // fertile_start - 1
    ovulationDate,
    fertileStart,
    fertileEnd: ovulationDate,
    lutealStart: shiftDays(ovulationDate, 1),
    lutealEnd: shiftDays(periodStart, cycleLength - 1),
  };
}
```

2. `applyPhaseToDays`: emit follicular between period and fertile:

```ts
const follicular = marker === 'P' ? 'Fl' : 'fl';
// in range(): period, then follicular, then fertile, then ovulation, then luteal
```

3. `computePhaseRanges` / `PhaseRange` / `PHASE_KEYS` / `PHASE_LETTERS`: add `'follicular'` → `['Fl', 'fl']`.

4. `PHASE_META`: add a real `fertile` entry (lilac) — the current mapping "fertile → follicular meta" is replaced by distinct metas:

```ts
fertile: {
  bg: '#F3E5F5', fg: '#7B1FA2', accent: '#CE93D8',
  label: 'Fertile', emoji: '🌱', desc: 'Fertile window. Conception window.',
},
```

---

## B2. `components/ui/Calendar.tsx` — colors

`DAY_TYPE_COLORS` additions/edits:

```ts
const DAY_TYPE_COLORS: Record<string, { bg: string; text: string; dashed?: boolean }> = {
  P:  { bg: '#FF6B8A', text: '#FFFFFF' },
  p:  { bg: '#FFE4EC', text: '#B83058' },
  u:  { bg: '#FFE4EC', text: '#B83058', dashed: true },   // F2: light pink + dashed border
  c:  { bg: '#E0E0E0', text: '#9E9E9E' },
  Fl: { bg: '#FFDAB9', text: '#A0621A' },                  // C: soft peach (confirmed follicular)
  fl: { bg: '#FFF0E0', text: '#A0621A' },                  // C: light peach (predicted follicular)
  F:  { bg: '#CE93D8', text: '#FFFFFF' },
  f:  { bg: '#F3E5F5', text: '#7B1FA2' },
  O:  { bg: '#81C784', text: '#FFFFFF' },
  o:  { bg: '#E8F5E9', text: '#2E7D32' },
  L:  { bg: '#90CAF9', text: '#FFFFFF' },
  l:  { bg: '#E3F2FD', text: '#1565C0' },
  pw: { bg: '#FFE9F0', text: '#B83058', dashed: true },    // B: light-pink window band
  T:  { bg: '#42A5F5', text: '#FFFFFF' },
};
```

Notes:
- `u` was `bg: 'transparent'` + dashed; now light pink + dashed (pending badge look).
- `pw` uses dashed + near-`p` pink so the band reads as "uncertain period".
- No component logic change — the `dashed` styling path already exists (`isPredicted`/`cellBorderStyle`).

---

## B3. `screens/calendar/CalendarScreen.tsx` — legend, phases, overview

1. Legend `PHASES` (line 42): add Follicular pill; include `pw` under Period filter:

```ts
const PHASES = [
  { key: 'P',  emoji: '🩸', label: 'Period',      color: '#F48FB1', letters: 'Ppw' },
  { key: 'Fl', emoji: '🌱', label: 'Follicular',  color: '#FFDAB9', letters: 'Flfl' },
  { key: 'F',  emoji: '💮', label: 'Fertile',     color: '#CE93D8', letters: 'Ff' },
  { key: 'O',  emoji: '🌟', label: 'Ovulation',  color: '#81C784', letters: 'Oo' },
  { key: 'L',  emoji: '🌙', label: 'Luteal',      color: '#90CAF9', letters: 'Ll' },
];
```

`letters: 'Flfl'` works with the existing `letters.includes(code)` filter (a single code like `'Fl'` is contained). Period filter now also keeps `pw` days visible.

2. `getPhaseForDate` / `getPhaseAccent`: add `Fl`/`fl` (peach → label `'Follicular'`, color `#FFDAB9`); keep the existing `toUpperCase()` fallback path.

3. `OVERVIEW_META`: map the five keys to real metas:

```ts
const OVERVIEW_META = {
  menstrual:  PHASE_META.menstrual,
  follicular: PHASE_META.follicular,
  fertile:    PHASE_META.fertile,
  ovulation:  PHASE_META.ovulation,
  luteal:     PHASE_META.luteal,
};
```

`computePhaseRanges` now returns 5 ranges → the Phase Overview renders 5 cards (follicular card appears, no longer merged into fertile).

---

## B4. `utils/backfillCards.ts` + `hooks/useCatchUp.ts` — real average (G3)

```ts
export function getBackfillCards(
  entries: Array<{ period_start_date: string; cycle_type?: string }>,
  today: Date,
  avgCycle?: number,
): BackfillCard[] {
  const lastEntry = entries?.[0];
  if (!lastEntry) return [];
  if (lastEntry.cycle_type === 'anovulatory') return [];
  // derive average cycle from consecutive gaps in [20, 45] (same rule as backend)
  const effective = avgCycle ?? (() => {
    const gaps: number[] = [];
    for (let i = 1; i < (entries?.length ?? 1); i++) {
      const gap = Math.round(
        (new Date(entries[i - 1].period_start_date + 'T00:00:00').getTime()
         - new Date(entries[i].period_start_date + 'T00:00:00').getTime()) / 86400000,
      );
      if (gap >= 20 && gap <= 45) gaps.push(gap);
    }
    return gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 28;
  })();
  // ... existing body using `effective` instead of `avgCycle = 28`
}
```

- `useCatchUp.ts:44` needs **no change** (it already passes `entries`); the average is derived.
- Expected `expectedStart`/`expectedEnd` stay `YYYY-MM-DD`.

---

## B5. Timezone — device-local "today" (H)

### New helper `mobile/src/utils/date.ts`

```ts
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse an ISO date key as LOCAL midday to avoid UTC offset drift. */
export function parseISODateLocal(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
```

### Replace UTC-based "today" (`toISOString().split('T')[0]`) with local

| File | Line | Change |
|------|------|--------|
| `hooks/usePeriodCheckIn.ts` | 31 | `toDateStr` → `toLocalDateStr` (import from `utils/date`) |
| `screens/calendar/CalendarScreen.tsx` | 32 | `toDateStr` → `toLocalDateStr` |
| `components/home/CheckInCard.tsx` | 26 | `new Date().toISOString().split('T')[0]` → `toLocalDateStr(new Date())` |
| `components/home/CatchUpCard.tsx` | 37 | same |
| `components/ui/StickyCard.tsx` | 20 | same |
| `components/ui/MarkEndDateModal.tsx` | 25 | same |
| `screens/cycle/CycleDashboardScreen.tsx` | 67 | default value → local |
| `screens/cycle/CyclePredictionsScreen.tsx` | 28 | `toDateStr` → local |
| `components/ui/BackfillCard.tsx` | 82/119/134 | date formatting → local |

> **Caution:** never run a stored `YYYY-MM-DD` string through `new Date(s)` and then local getters (a `UTC-` zone shifts the day). Always parse via `parseISODateLocal` first, or keep strings as strings.

### Backend `today` anchor

`GET /cycle/calendar` (`services.py` line 504) accepts an **optional `today` query param** (client-local `YYYY-MM-DD`), falling back to `date.today()`:

```python
today_str_param = request today query param if given
today_ref = date.fromisoformat(today_str_param) if valid else date.today()
```

This keeps the `T` marker and the scaled `needs_checkin` window aligned with the phone's calendar day. Mobile `useCycleCalendar` sends `today: toLocalDateStr(new Date())`.

---

## Verification

- TypeScript: `tsc --noEmit` clean.
- Mobile tests: see `cycleplan3.md`.
- Manual: `.\start.ps1` in `E:\her_care\mobile` → exercise legend filters, Phase Overview (5 cards), `u`/`pw`/`Fl` rendering, backfill cards.
