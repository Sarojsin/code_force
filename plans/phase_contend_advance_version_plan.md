# Phase Detail Sheet — Advanced Version Plan

> Refinement of Phase 1 Calendar Phase Overview upgrade.
> Addresses 5 feedback items + 4 implementation gotchas.

---

## Scope

Extract `PhaseDetailContent` into its own file, fix the progress bar (uses wrong phase range), replace fake "Energy Today" with real "Mood Today", split physical signs into actionable vs informational, and fix sheet stacking.

**No backend changes. No database changes. Mobile-only.**

---

## 1. Files to Change

| # | File | Action |
|---|------|--------|
| 1 | `mobile/src/constants/phaseContent.ts` | Edit: split `physicalSigns` into `actionableSigns` + `infoSigns` |
| 2 | `mobile/src/components/calendar/PhaseDetailSheet.tsx` | **New**: extract `PhaseDetailContent` + `StarRow` from CalendarScreen |
| 3 | `mobile/src/screens/calendar/CalendarScreen.tsx` | Edit: remove inline components, import PhaseDetailSheet, fix sheet stacking, add mood today, fix pre-fill reset, pass actual phase range |

**Not changed:** `DayDetailSheet.tsx` (already accepts `symptoms: string[]` labels — no prop changes needed).

---

## 2. Detailed Changes

### 2.1 `constants/phaseContent.ts` — Split Signs

**Current:**
```typescript
physicalSigns: string[];
```

**New:**
```typescript
actionableSigns: string[];  // must match DayDetailSheet SYMPTOM_OPTIONS labels exactly
infoSigns: string[];         // educational only, rendered as read-only bullets
```

**DayDetailSheet's `SYMPTOM_OPTIONS`** (the 8 actionable labels):
```
Cramps, Bloating, Headache, Fatigue, Nausea, Backache, Breast tenderness, Acne
```

**Per-phase mapping:**

| Phase | actionableSigns | infoSigns |
|-------|----------------|-----------|
| menstrual | Cramps, Headache, Fatigue, Nausea | Menstrual flow (color & intensity), Energy levels |
| follicular | Fatigue | Cervical mucus (dry/sticky), Basal body temperature (lower), Skin clearing up, Increased energy |
| fertile | *(empty)* | Egg-white cervical mucus, Increased libido, Mild pelvic ache |
| ovulation | *(empty)* | Light spotting, Sharp pelvic pain (Mittelschmerz), BBT spike, Peak energy |
| luteal | Cramps, Bloating, Breast tenderness, Fatigue | Mood shifts, Increased appetite, BBT stays high |

### 2.2 `components/calendar/PhaseDetailSheet.tsx` — New File

Extracted from CalendarScreen's inline `PhaseDetailContent` + `StarRow`.

**Props:**
```typescript
interface PhaseDetailSheetProps {
  phaseKey: PhaseRange['key'];
  phaseStartDay: number | null;   // from phaseRanges (actual phase bounds)
  phaseEndDay: number | null;     // from phaseRanges (actual phase bounds)
  predictedCycleLength: number;   // caller already has fallback ?? 28
  cycleDay: number;               // current day of cycle (1-indexed)
  todayMood: { mood: string; intensity: number } | null;
  cycleStats: { lengths: number[]; stdDev: number; irregularCount: number };
  onLogToday: () => void;
  onPreFill: (symptoms: string[]) => void;
}
```

**Imports needed:**
- `useState` from React
- `View, Text, Pressable` from react-native
- `LinearGradient` from expo-linear-gradient
- `MOOD_OPTIONS` from `src/components/ui/MoodPicker`
- `PHASE_CONTENT` from `src/constants/phaseContent`
- `palette, useTheme` from `src/theme`
- `Button` from `src/components/ui`
- `PhaseRange` from `src/utils/cyclePhases`

**Section layout (top to bottom):**

1. **Gradient hero** — emoji, label, day range (`phaseStartDay–phaseEndDay of predictedCycleLength`)

2. **Progress bar** — with edge-case clamping:
   ```
   if phaseStartDay === null || phaseEndDay === null
     → "This phase is upcoming" + 0%
   else if phaseStartDay === phaseEndDay
     → "Today is the peak day" + 100%
   else if cycleDay < phaseStartDay
     → "This phase is upcoming" + 0%
   else if cycleDay > phaseEndDay
     → "This phase is over" + 100%
   else
     → "Day {cycleDay - phaseStartDay + 1} of {phaseEndDay - phaseStartDay + 1} ({pct}%)"
   ```

3. **"Your Body Right Now"** —
   - Typical energy + mood star rows (5-dot scale, reuse `StarRow`)
   - **Mood Today** (replaces "Energy Today"):
     - If `todayMood !== null` → `{emoji} {mood.label} · Intensity {●×intensity}{○×(5-intensity)}`
     - If `todayMood === null` → `—  Log it` (pressable, calls `onLogToday`)
   - Actionable signs → tappable chips (pre-fill symptoms)
   - Info signs → read-only bullet list

4. **"What You Can Do"** — nutrition, exercise, action callout

5. **Ovulation note** — if phaseKey is `ovulation`, show predicted day

6. **Irregular caveat** — `stdDev > 5 || irregularCount > 0`:
   > "Your last N cycles were X, Y, Z days. Because they vary by up to {stdDev} days, predicting ovulation is tricky — we recommend tracking cervical mucus or using ovulation tests for accuracy."

7. **CTA button** — "Log today's symptoms for this phase"

**Helper:** `MOOD_EMOJI_MAP` built from `MOOD_OPTIONS` (label → emoji lookup).

### 2.3 `screens/calendar/CalendarScreen.tsx` — Refactor

**Remove:**
- `StarRow` component (moved to PhaseDetailSheet)
- `PhaseDetailContent` component (moved to PhaseDetailSheet)
- `computeCycleLengthStats` function (moved to PhaseDetailSheet or kept inline but enhanced)

**Add imports:**
- `PhaseDetailSheet` from `src/components/calendar/PhaseDetailSheet`
- `useMoodLogs` from `src/services/queries`

**Enhance `computeCycleLengthStats`:**
```typescript
function computeCycleLengthStats(entries: { period_start_date: string; period_end_date?: string | null }[]) {
  // Filter out open cycles (period_end_date is null) — they have no computed length
  const completed = entries.filter(e => e.period_end_date);
  if (completed.length < 2) return { lengths: [], stdDev: 0, irregularCount: 0 };
  const sorted = [...completed].sort((a, b) => a.period_start_date.localeCompare(b.period_start_date));
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i].period_start_date).getTime() - new Date(sorted[i - 1].period_start_date).getTime()) / 86_400_000;
    if (diff >= 20 && diff <= 45) lengths.push(Math.round(diff));
  }
  if (lengths.length < 2) return { lengths, stdDev: 0, irregularCount: 0 };
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
  const irregularCount = lengths.filter(l => l < 21 || l > 35).length;
  return { lengths, stdDev, irregularCount };
}
```

> **Note:** `list_entries` backend query does NOT filter out open cycles (period_end_date=null).
> The mobile client MUST filter here to avoid NaN/0 lengths breaking stdDev.

**Add todayMood derivation:**
```typescript
const { data: moodLogs } = useMoodLogs({ per_page: 50 });
const todayMood = useMemo(() => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLog = moodLogs?.find(l => l.logged_at?.startsWith(todayStr));
  if (!todayLog) return null;
  return { mood: todayLog.mood, intensity: todayLog.intensity };
}, [moodLogs]);
```

**Fix sheet stacking in `openDaySheetFromPhase`:**
```typescript
const openDaySheetFromPhase = useCallback(() => {
  setSelectedPhaseDetail(null);  // close phase sheet first
  setTimeout(() => {
    setSelectedDate(today);
    setSelectedMood(null);
    setMoodIntensity(5);
    setNoteText('');
    setSelectedSymptoms(preFillSymptoms);
    setShowDaySheet(true);       // open day sheet after animation
  }, 300);
}, [today, preFillSymptoms]);
```

**Fix pre-fill reset in `handlePhasePress`:**
```typescript
const handlePhasePress = (key: PhaseRange['key']) => {
  setPreFillSymptoms([]);  // clear old selections
  setSelectedPhaseDetail(key);
};
```

**Pass actual phase range to PhaseDetailSheet:**
```typescript
<PhaseDetailSheet
  phaseKey={selectedPhaseDetail}
  phaseStartDay={phaseRanges.find(r => r.key === selectedPhaseDetail)?.startDay ?? null}
  phaseEndDay={phaseRanges.find(r => r.key === selectedPhaseDetail)?.endDay ?? null}
  predictedCycleLength={predictedCycleLength}
  cycleDay={cycleDay}
  todayMood={todayMood}
  cycleStats={cycleStats}
  onLogToday={openDaySheetFromPhase}
  onPreFill={(symptoms) => setPreFillSymptoms(symptoms)}
/>
```

---

## 3. Edge Cases

| Case | Behavior |
|------|----------|
| `phaseStartDay === null` (no data) | "This phase is upcoming" + 0% bar |
| `cycleDay > phaseEndDay` (phase passed) | "This phase is over" + 100% bar |
| `phaseStartDay === phaseEndDay` (1-day phase) | "Today is the peak day" + 100% bar |
| No mood log today | "—" with pressable "Log it" |
| Fewer than 2 completed cycles | `stdDev: 0, irregularCount: 0` → no caveat |
| Sign appears in multiple phases | Pre-fill accumulates via array, no duplicates |
| User reopens same phase sheet | `preFillSymptoms` resets to `[]` on open |
| Stacked bottom sheets | PhaseDetailSheet dismisses first, DayDetailSheet opens after 300ms |
| Brand-new user (no predictions) | `predictedCycleLength` falls back to 28 |

---

## 4. What We Are NOT Changing

- `DayDetailSheet.tsx` — no new props needed
- `BottomSheet.tsx` — no onDismiss needed (using setTimeout)
- Backend — no API changes
- Database — no schema changes
- `useCurrentCycleState.ts` — cycleDay computation unchanged
- `cyclePhases.ts` — phase range computation unchanged

---

## 5. Verification

After implementation, run:
1. `npx tsc --noEmit` (from mobile/) — type check
2. `npx eslint src/components/calendar/PhaseDetailSheet.tsx src/screens/calendar/CalendarScreen.tsx src/constants/phaseContent.ts` — lint
3. Manual checks:
   - Tap a phase card → sheet opens with correct day range
   - Progress bar shows correct percentage for current day
   - Tap "Log today's symptoms" → phase sheet closes, day sheet opens
   - Tap actionable sign chips → pre-fill accumulates, no duplicates
   - Reopen same sheet → chips are cleared
   - Check mood today shows emoji + intensity dots
   - Check irregular caveat appears for test user with varied cycles
