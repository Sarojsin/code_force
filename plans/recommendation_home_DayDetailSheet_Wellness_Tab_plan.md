# Recommendation Engine — 3-Surface Tiered Placement

> Status: **Draft for review** — verify before any code.
> Depends on: PR 1 (backend master), PR 2 (mobile taxonomy), PR 3 (engine), PR 4 (carousel action wiring), PR 5 (safety + Wellness surface).

---

## 1. Objective

Place the recommendation engine across three surfaces in a tiered strategy:

| Surface | Purpose | Content |
|---------|---------|---------|
| **Home Dashboard** | Prime real estate — first thing user sees | Single compact "Today's Insight" banner |
| **DayDetailSheet** | Feedback loop — post-log confirmation | Full carousel (up to 3 cards) or AIInsightCard |
| **Wellness Tab** | The hub / library | Full carousel with "For today" block + Mark-Done |

The Home screen is the missing piece. Users land here daily. A single actionable insight bridges the gap between "discovery" (Wellness) and "feedback" (DayDetailSheet).

---

## 2. Current State (verified)

| Item | Path | Detail |
|------|------|--------|
| Engine | `mobile/src/utils/expertRecommendations.ts` | `getRecommendations(input)` → 0-3 `RecommendationCard[]`. Returns `[]` when `painLevel >= 7`. Returns motivation card when no symptoms + pain < 2. |
| Defensive mapper | `mobile/src/utils/expertRecommendations.ts` | `getRecommendationInputFromDay(day, phaseKey)` — handles `day === null` gracefully (defaults to `painLevel: 0`, empty symptoms). |
| DayDetailSheet | `mobile/src/components/ui/DayDetailSheet.tsx` | Shows `RecommendationCarousel` when `tier === 'recommendation'` (line 417). Shows `AIInsightCard` otherwise. Already implemented (PR 4). |
| Wellness tab | `mobile/src/components/ui/wellness/DynamicRecommendations.tsx` | Prepends "For today" engine block via `getRecommendationInputFromDay`. Already implemented (PR 5). |
| Home screen | `mobile/src/screens/home/HomeDashboardScreen.tsx` | Uses `useCurrentCycleState` only. Has `phaseKey` but NOT today's `CycleDay` (no pain/symptoms). **No recommendation surface.** |
| `useTodayDayData` | N/A | **Does not exist.** Needs creation. |
| Wellness tab route | `mobile/src/navigation/MainTabs.tsx:156` | `'Wellness'` at MainTabs level. Navigation: `navigate('Main', { screen: 'Wellness' })`. |

---

## 3. Safety Rules

| Rule | Implementation |
|------|---------------|
| **NEVER show `seek_care` on Home** | `getRecommendations` returns `[]` when `painLevel >= 7` (PR 3). Banner also checks `input.painLevel >= 7` and returns null as defense-in-depth. |
| **NEVER show `seek_care` on Wellness** | `DynamicRecommendations` silently skips engine cards when tier is `seek_care`. |
| **DayDetailSheet handles `seek_care`** | When `tier === 'seek_care'`, the sheet saves the log but shows no carousel and no motivational card (PR 4 design). |
| **`dayData === null` never crashes** | `getRecommendationInputFromDay` defaults all fields. Banner shows motivation text when no data. |

---

## 4. Changes

### 4.1 `mobile/src/hooks/useTodayDayData.ts` (NEW)

Lightweight offline-first hook. SQLite only, no network calls.

```ts
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useAuthStore } from 'src/stores/authStore';
import { localDb } from 'src/services/localDb';
import type { CycleDay } from 'src/db/schema';

export function useTodayDayData(): CycleDay | null {
  const userId = useAuthStore((s) => s.user?.id);
  const [dayData, setDayData] = useState<CycleDay | null>(null);

  useEffect(() => {
    if (!userId) { setDayData(null); return; }
    const today = format(new Date(), 'yyyy-MM-dd');
    localDb.cycleDay.getByDate(userId, today).then(setDayData);
  }, [userId]);

  return dayData;
}
```

Follows the same pattern as the inline code in `useWellnessDashboard.ts:50-64`. Returns `CycleDay | null`.

### 4.2 `mobile/src/components/home/HomeRecommendationBanner.tsx` (NEW)

Compact horizontal banner — one card, one-line title, chevron.

**Props:**
```ts
interface HomeRecommendationBannerProps {
  dayData: CycleDay | null;
  phaseKey: string;
}
```

**Logic:**
1. `getRecommendationInputFromDay(dayData, phaseKey)` → input
2. `getRecommendations(input)` → cards
3. Safety: `if (input.painLevel >= 7) return null`
4. Select first card: `cards[0]` (engine returns motivation card when no symptoms + pain < 2)
5. Render as compact `Pressable` with icon, truncated title, chevron
6. `onPress` → `navigation.navigate('Main', { screen: 'Wellness' })`

**When `dayData` is null:** Engine returns motivation card → banner shows phase-locked motivation.

**When `painLevel >= 7`:** Returns null. No banner rendered.

**Render structure:**
```
Pressable (accessibilityRole="button")
├── Icon emoji (fontSize 20)
├── Title (numberOfLines={1}, ellipsizeMode="tail", flex 1)
└── ChevronRight (lucide-react-native, size 16)
```

**Styling:** `theme.colors.surface` background, `theme.radius.md`, 12px horizontal padding, `theme.colors.border` border.

### 4.3 `mobile/src/screens/home/HomeDashboardScreen.tsx` (MODIFY)

**Imports to add:**
```ts
import { useTodayDayData } from 'src/hooks/useTodayDayData';
import { HomeRecommendationBanner } from 'src/components/home/HomeRecommendationBanner';
```

**Hook call** (after line 43, near other hook calls):
```ts
const dayData = useTodayDayData();
```

**JSX reorder and insertion:**

Current order:
```
Hero (delay 0) → Phase Timeline (delay 1) → Check-In (delay 2) → Catch-Up (delay 3) → ...
```

New order (per user spec: Hero → Check-In → Banner → Phase Timeline):
```
Hero (delay 0) → Check-In (delay 1) → Banner (delay 2) → Phase Timeline (delay 3) → Catch-Up (delay 4) → ...
```

Insert after Check-In `AnimatedSection` (after line 285):
```tsx
{hasCycleData && (
  <AnimatedSection delay={staggerItems[2]}>
    <HomeRecommendationBanner dayData={dayData} phaseKey={phaseKey} />
  </AnimatedSection>
)}
```

Bump downstream delays by +1 index.

---

## 5. Component Order (After)

```
HomeDashboardScreen
├── Hero Card (AnimatedSection delay 0)
│   └── LinearGradient + Phase Pill + Cycle Ring + Stats Row
├── Check-In Card (AnimatedSection delay 1)
│   └── Period prediction + Mood check-in
├── HomeRecommendationBanner (AnimatedSection delay 2) [NEW]
│   └── Single insight/motivation card → tap → Wellness tab
├── Phase Timeline (AnimatedSection delay 3)
│   └── Horizontal scroll: Menstrual | Follicular | Ovulation | Luteal
├── Catch-Up Card (AnimatedSection delay 4)
├── Bento Row (Journal + Diary)
└── Health Library card
```

---

## 6. Data Flow (After)

```
HomeDashboardScreen
├── useCurrentCycleState(3,3) → phaseKey, cycleDay, hasCycleData
├── useTodayDayData() [NEW] → dayData: CycleDay | null
└── HomeRecommendationBanner
     ├── getRecommendationInputFromDay(dayData, phaseKey) → input
     ├── getRecommendations(input) → cards[]
     └── Filter: if painLevel >= 7 → return null
```

---

## 7. Surface Behavior Summary

| Surface | Where | What | When | Action |
|---------|-------|------|------|--------|
| **Home Dashboard** | Below Check-In Card | Single compact Insight/Motivation card | Always (if user has cycle data) | Tap → Wellness tab |
| **DayDetailSheet** | Calendar → tap today | Full Carousel (up to 3 cards) or AIInsightCard | After logging (post-save) | CTAs + Mark Done |
| **Wellness Tab** | Bottom Nav → Wellness | Full Carousel + "For today" block | Always (if logged today) | Full interactivity |

---

## 8. Tests

- `useTodayDayData`:
  - Returns `null` when userId is null
  - Returns `CycleDay` when local DB has today's entry
  - Returns `null` when no entry exists for today
- `HomeRecommendationBanner`:
  - With `dayData` having pain 5 + cramps → shows first recommendation card
  - With `dayData` null → shows motivation text
  - With `painLevel >= 7` → returns null (no banner)
  - Tap navigates to Wellness tab
- `HomeDashboardScreen`:
  - Banner renders between Check-In and Phase Timeline when `hasCycleData` is true
  - Banner does NOT render when `hasCycleData` is false

---

## 9. Files Changed

| File | Change | Risk |
|------|--------|------|
| `mobile/src/hooks/useTodayDayData.ts` | New hook: SQLite fetch for today's CycleDay | Low |
| `mobile/src/components/home/HomeRecommendationBanner.tsx` | New component: compact insight banner | Low |
| `mobile/src/screens/home/HomeDashboardScreen.tsx` | Import hooks, reorder JSX, insert banner | Low |

---

## 10. Mobile Gates

```
cd mobile
npx tsc --noEmit
npx jest src/hooks src/components/home
npx eslint src/hooks/useTodayDayData.ts src/components/home/HomeRecommendationBanner.tsx src/screens/home/HomeDashboardScreen.tsx
```

---

## 11. AGENTS Checklist

- [ ] `useTodayDayData` hook created (SQLite-only, no network)
- [ ] `HomeRecommendationBanner` created (compact, single-card, tap → Wellness)
- [ ] `HomeDashboardScreen` reordered (Hero → Check-In → Banner → Phase Timeline)
- [ ] Safety: `painLevel >= 7` → no banner on Home
- [ ] `dayData === null` → motivation text shown (no crash)
- [ ] Navigation route verified: `'Main' → { screen: 'Wellness' }`
- [ ] No backend changes
- [ ] tsc + jest + eslint green
