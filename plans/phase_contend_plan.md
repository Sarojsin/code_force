# Phase 1 — Dynamic Phase Overview with Educational Content

## Goal

Upgrade the Phase Overview section on the Calendar screen from static, generic cards to clickable, educational cards with a detail bottom sheet.

## Summary

| What | Status |
|------|--------|
| Dynamic phase ranges | Already works — `computePhaseRanges` uses actual/predicted cycle data |
| Enriched collapsed cards | Need to build — add energy tag, physical cue, action line |
| Clickable → detail sheet | Need to build — new `PhaseDetailSheet` using existing `BottomSheet` |
| Educational content | Need to build — centralized constants file |
| Dynamic fertile window | Already works — `calculateCyclePhases` uses `cycleLength - 14` |
| Backend changes | None |
| DB changes | None |

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `mobile/src/constants/phaseContent.ts` | **Create** | Centralized educational content for all 5 phases |
| `mobile/src/screens/calendar/CalendarScreen.tsx` | **Modify** | Enrich collapsed cards, make clickable, add detail sheet |

No backend changes. No DB changes. No store changes.

---

## Step 1: Create `mobile/src/constants/phaseContent.ts`

### Type definition

```ts
export interface PhaseContent {
  key: string;
  emoji: string;
  label: string;
  bg: string;          // soft background for collapsed card
  fg: string;          // accent color for text/badges
  desc: string;        // one-liner for collapsed card
  energyTag: string;   // e.g. "⚡ Rising Energy"
  physicalCue: string; // e.g. "Cervical mucus becomes wet & stretchy."
  action: string;      // e.g. "Great time for cardio & socializing."
  hormones: { name: string; level: number }[];
  typicalEnergy: number;  // 1-5 star rating for this phase
  typicalMood: number;    // 1-5 star rating for this phase
  nutrition: string[];
  exercise: string[];
  physicalSigns: string[];
}
```

### Content for all 5 phases

Sourced from `MenstrualPhasesScreen:43-112` and enriched with educational content.

#### Menstrual
- emoji: 🩸, bg: `#FFE4EC`, fg: `#B83058`
- desc: "Rest & restore. Honour your body."
- energyTag: "⚡ Low Energy"
- physicalCue: "Menstrual flow, cramps, lower energy levels."
- action: "Prioritize rest and warmth."
- hormones: Estrogen (1), Progesterone (1)
- typicalEnergy: 1, typicalMood: 2
- nutrition: Iron-rich foods, Vitamin C for absorption, Stay hydrated, Warm meals
- exercise: Gentle yoga, Light walking, Avoid high intensity
- physicalSigns: Menstrual blood color & flow, Cramps intensity, Energy levels

#### Follicular
- emoji: 🌱, bg: `#FFF4E3`, fg: `#A0621A`
- desc: "Rising energy. Fresh beginnings."
- energyTag: "⚡ Rising Energy"
- physicalCue: "Cervical mucus becomes wet & stretchy."
- action: "Great time for cardio & socializing."
- hormones: Estrogen (4), Progesterone (1)
- typicalEnergy: 4, typicalMood: 5
- nutrition: Complex carbs, Leafy greens, Omega-3 fatty acids
- exercise: Cardio, Strength training, Dance
- physicalSigns: Cervical mucus (dry/sticky), Basal body temperature (lower), Skin clearing up

#### Fertile
- emoji: 💮, bg: `#F3E5F5`, fg: `#7B1FA2`
- desc: "Peak fertility. Conception window."
- energyTag: "⚡ High Energy"
- physicalCue: "Egg-white cervical mucus (stretchy, clear), increased libido."
- action: "Prioritize connection and communication."
- hormones: Estrogen (5), LH (3)
- typicalEnergy: 4, typicalMood: 5
- nutrition: Healthy fats (avocado, nuts), Lean protein
- exercise: Moderate exercise, Yoga, Walking
- physicalSigns: Egg-white cervical mucus, Increased libido, Mild pelvic ache

#### Ovulation
- emoji: 🌟, bg: `#E5F9F0`, fg: `#1A6B45`
- desc: "Peak vitality. Magnetic energy."
- energyTag: "⚡ Peak Energy"
- physicalCue: "Light spotting, sharp pelvic pain (Mittelschmerz)."
- action: "Schedule important meetings. Try new activities."
- hormones: LH (5), FSH (5)
- typicalEnergy: 5, typicalMood: 5
- nutrition: Antioxidant-rich berries, Lean protein, Hydrating fruits
- exercise: HIIT, Running, Swimming
- physicalSigns: Light spotting, Sharp pelvic pain (Mittelschmerz), BBT spike

#### Luteal
- emoji: 🌙, bg: `#EFE8FA`, fg: `#5A35A0`
- desc: "Wind down. Nurture yourself."
- energyTag: "⚡ Lower Energy"
- physicalCue: "Breast tenderness, bloating, mood shifts."
- action: "Switch to strength training. Prioritize sleep."
- hormones: Progesterone (5), Estrogen (3)
- typicalEnergy: 2, typicalMood: 2
- nutrition: Magnesium-rich foods, Dark chocolate, Herbal teas, Complex carbs
- exercise: Pilates, Stretching, Light yoga
- physicalSigns: Breast tenderness, Bloating, Mood shifts, Increased appetite, BBT stays high

---

## Step 2: Enrich Collapsed Cards in `CalendarScreen`

### Current layout (lines 376-401)

```
🩸  Menstrual          [Day 1–5]
    Rest & restore. Honour your body.
```

### New layout

```
🩸  Menstrual                    [Day 1–5]
    ⚡ Low Energy · Rest & restore. Honour your body.
```

- Line 1: emoji + phase name (left), day range badge (right) — **unchanged**
- Line 2: energy tag (left) + desc (right, truncated) — **new**
- Background: soft `meta.bg` color — **unchanged**
- Card is now a `Pressable` with `onPress` handler

---

## Step 3: Make Cards Clickable → Open `PhaseDetailSheet`

### State

Add to `CalendarScreen`:
```ts
const [selectedPhase, setSelectedPhase] = useState<PhaseRange['key'] | null>(null);
```

### New component: `PhaseDetailSheet`

Lives inline in `CalendarScreen.tsx`. Uses existing `BottomSheet` component.

### Layout (incorporating all7 suggestions)

1. **Hero section** — gradient header with emoji + phase name + dynamic range
   - "Day 6–13 of 30" (total cycle length from `predictedCycleLength`)

2. **Progress bar** — "You are on Day 8 of this 8-day phase (75% complete)"
   - Uses `cycleDay` and phase range to compute position

3. **"Your Body Right Now"** section (grouped):
   - **Typical Energy**: star rating (static, from `typicalEnergy`)
   - **Your Energy Today**: star rating from today's mood log, or "—" with prompt to log
   - **Physical Signs**: tappable checklist items (tap → pre-fills symptom for logging)

4. **"What You Can Do"** section (grouped):
   - **Nutrition**: bulleted list with emojis
   - **Exercise**: bulleted list with emojis
   - **Action**: one-liner recommendation

5. **CTA button** — "Log today's symptoms for this phase"
   - Always targets today (not the phase's date)
   - Opens existing `DayDetailSheet` for today
   - Pre-fills any symptoms tapped from the physical signs list

6. **Irregular cycle note** (conditional, using actual volatility)
   - Shown if `cycle_length_std_dev > 3.5`
   - "Your last 3 cycles were {a}, {b}, and {c} days. Because they vary by up to {stdDev} days, predicting ovulation is tricky — we recommend tracking cervical mucus or using ovulation tests for accuracy."

---

## Step 4: Physical Signs → Tappable Pre-fill

Each physical sign in the detail sheet is a `Pressable` chip:
- Tap toggles selection (visual highlight)
- Selected signs are passed to `DayDetailSheet` as pre-filled symptoms
- When user opens "Log today's symptoms", these are already checked

Implementation:
- Add `selectedPreFill` state to `CalendarScreen`
- Pass to `DayDetailSheet` as `initialSymptoms` prop
- `DayDetailSheet` merges with existing symptom selection

---

## Step 5: Energy Today — Dynamic from Mood Log

In the detail sheet, "Your Energy Today" shows:
- If today has a mood log: derive energy level from mood intensity (1-5 scale)
- If no mood log: show "—" with a subtle "Tap to log" prompt

This uses existing `useCreateMoodLog` data — no new queries needed.

---

## Step 6: Dynamic Fertile Window

Already works in `calculateCyclePhases` (`cyclePhases.ts:40-42`):
```ts
const ovulationOffset = Math.max(10, Math.min(cycleLength - 14, 40));
const fertileStart = shiftDays(ovulationDate, -4);
```

In the detail sheet, show:
> "Ovulation predicted around Day {cycleLength - 14}"

---

## Step 7: What Stays the Same

- No backend changes
- No DB changes
- No store changes
- `computePhaseRanges` unchanged (already dynamic)
- `calculateCyclePhases` unchanged (already uses `cycleLength - 14`)
- `BottomSheet` component reused as-is
- Existing `DayDetailSheet` reused for symptom logging
- `PHASE_META` in `cyclePhases.ts` unchanged (still used for calendar day coloring)
- `phaseContent.ts` is purely visual/educational — no overlap with `PHASE_META`

---

## Verification

1. `npx tsc --noEmit` — type check
2. `npx eslint src/screens/calendar/CalendarScreen.tsx src/constants/phaseContent.ts` — lint
3. Manual test:
   - Open Calendar screen
   - Verify phase cards show enriched content (energy tag + desc)
   - Tap a phase card
   - Verify detail sheet opens with progress bar, grouped sections, tappable signs
   - Tap a physical sign → verify it highlights
   - Tap "Log today's symptoms" → verify DayDetailSheet opens with pre-filled symptoms
   - Close detail sheet → verify calendar still works
   - Test with different cycle lengths (28, 35, 24) → verify ranges shift dynamically
   - Test irregular cycle (stdDev > 3.5) → verify volatility note appears
