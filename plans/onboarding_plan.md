# Onboarding Plan: Info Banner + Live Cycle-Length Calculation

## Overview

Two UX improvements to the onboarding flow that reduce user anxiety about remembering exact dates.

| Feature | Where | What |
|---------|-------|------|
| **Info banner** | `PastCycleScreen.tsx` | Soft reassuring banner below date picker |
| **Live cycle-length** | `PastCycleScreen.tsx` + `CurrentCycleScreen.tsx` | Auto-calculated gap shown next to date |

---

## 1. Info Banner (`PastCycleScreen.tsx`)

**Location:** Below the `DatePickerField`, above the period-length field.

**Copy:**
```
💡 Don't remember the exact dates?
It's okay! Just pick the closest dates you can remember.
Our system will automatically refine and correct your cycle patterns over time.
You don't have to be perfect right now.
```

**Style:** Soft `palette.accent50` (`#F5F0FF`) background, `borderRadius: 16`, `padding: 14`, with a `💡` emoji. Matches the existing card pattern but visually distinct (no shadow, lighter bg).

---

## 2. Live Cycle-Length Calculation

### Data flow (navigation order: CurrentCycle → PastCycle1 → PastCycle2 → PastCycle3)

| Screen | Store state at render | Next period date source | Gap = next − this |
|--------|----------------------|------------------------|-------------------|
| CurrentCycle | `pastCycles=[]` | N/A (ongoing) | "Ongoing 🔄" |
| PastCycle1 | `currentCycleStart` set, `pastCycles=[]` | `currentCycleStart` | currentCycleStart − thisCycleStart |
| PastCycle2 | `pastCycles=[PastCycle1]` | `pastCycles[0].cycle_start` | pastCycles[0].cycle_start − thisCycleStart |
| PastCycle3 | `pastCycles=[PastCycle1, PastCycle2]` | `pastCycles[1].cycle_start` | pastCycles[1].cycle_start − thisCycleStart |

### Implementation

- Add a `daysBetween(a: string, b: string): number` utility (simple `Date` arithmetic, returns `Math.round(Math.abs(b - a) / 86400000)`).
- In `PastCycleScreen`: read `currentCycleStart` + `pastCycles` from the store via `useOnboardingStore`. Use `watch('cycleStart')` from react-hook-form. Compute gap based on `cycleNum`. Display below the date picker as a pill/badge: `"📅 ~31 days until your next period"`.
- In `CurrentCycleScreen`: add a static text below the date picker: `"Ongoing 🔄 — we'll calculate this when your next period starts"`. No gap calculation needed.
- No backend changes — the backend still receives raw dates and re-derives gaps server-side.

---

## 3. Files to Modify

| File | Change |
|------|--------|
| `mobile/src/screens/onboarding/PastCycleScreen.tsx` | Add info banner, add live gap display, import `daysBetween` |
| `mobile/src/screens/onboarding/CurrentCycleScreen.tsx` | Add "Ongoing" note below date picker |

No new files needed — `daysBetween` is a 3-line function, lives inline at the top of `PastCycleScreen.tsx`.

---

## 4. What Stays the Same

- **Backend:** no changes (raw dates sent, gaps re-derived server-side)
- **Store:** no changes (already stores `currentCycleStart` + `pastCycles`)
- **Validation schemas:** no changes
- **Navigation types:** no changes

---

## 5. Special Rules

- **CurrentCycle:** Do NOT calculate a length. Show: `"Ongoing 🔄 — we'll calculate this when your next period starts"`.
- **PastCycle1:** Gap = `currentCycleStart − thisCycleStart` (both available in store).
- **PastCycle2/3:** Gap = `pastCycles[N].cycle_start − thisCycleStart`.
- If dates aren't yet available (e.g. `currentCycleStart` not set on CurrentCycle), show `"—"`.
