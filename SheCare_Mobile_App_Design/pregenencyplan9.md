# pregenencyplan9 — Pregnancy Mode Toggle

> **Priority:** High
> **Files:** `src/stores/pregnancyModeStore.ts`, `src/screens/profile/SettingsScreen.tsx`, `src/screens/home/HomeDashboardScreen.tsx`, `src/screens/pregnancy/PregnancyHomeScreen.tsx`, `src/navigation/HomeStack.tsx`, `src/navigation/CalendarStack.tsx`, `src/screens/companion/LunaOverlay.tsx`, `src/screens/pregnancy/PregnancyCalendarScreen.tsx`

---

## 1. Toggle: Settings → Pregnancy Mode

### 1.1 Create `pregnancyModeStore.ts`

Zustand store in `src/stores/pregnancyModeStore.ts`:

```typescript
interface PregnancyModeState {
  isActive: boolean;
  currentWeek: number;
  dueDate: string | null;
  enable: () => void;
  disable: () => void;
  setWeek: (week: number) => void;
  setDueDate: (date: string) => void;
}
```

- Persisted to AsyncStorage
- `enable()` sets `isActive: true`
- `disable()` sets `isActive: false`
- `currentWeek` defaults to 14
- `dueDate` defaults to null

### 1.2 Fix Settings toggle

`SettingsScreen.tsx` line 215 — replace the broken placeholder:

| Before | After |
|---|---|
| `SettingRow label="Pregnancy Mode" ... onToggle={(v) => toggle('emailNotifications')(v)}` | `SettingRow label="Pregnancy Mode 🤰" description="Track trimester updates, baby size" value={isActive} onToggle={(v) => v ? enable() : disable()}` |

Move from NOTIFICATIONS section to its own section between AI & MODELS and COMPANION titled `PREGNANCY`.

---

## 2. Screen routing — Home tab

### 2.1 Problem

The Home tab currently always renders `HomeDashboardScreen` (cycle content). When pregnancy mode is ON, it should render `PregnancyHomeScreen` instead — same tab, same nav, swapped content.

### 2.2 Solution: HomeScreenRouter

Create `HomeScreenRouter` component that reads `pregnancyModeStore.isActive` and conditionally renders:

```tsx
function HomeScreenRouter() {
  const isActive = usePregnancyModeStore((s) => s.isActive);
  const setWeek = usePregnancyModeStore((s) => s.setWeek);
  const setDueDate = usePregnancyModeStore((s) => s.setDueDate);

  if (isActive) {
    return (
      <PregnancyHomeScreen
        onWeekChange={setWeek}
        onTrimesterChange={(t) => { /* feed to Luna */ }}
        onBabySizeChange={(s) => { /* feed to Luna */ }}
      />
    );
  }

  return <HomeDashboardScreen />;
}
```

### 2.3 HomeStack change

`HomeStack.tsx` — replace `HomeDashboardScreen` with `HomeScreenRouter` as the initial screen. `HomeDashboardScreen` is still importable (for the router), just not the direct stack component.

---

## 3. PregnancyHomeScreen — data lifting

### 3.1 Add callback props

```typescript
export interface PregnancyHomeScreenProps {
  onWeekChange?: (week: number) => void;
  onTrimesterChange?: (trimester: number) => void;
  onBabySizeChange?: (size: { fruit: string; emoji: string }) => void;
}
```

### 3.2 Wire setCurrentWeek to onWeekChange

```typescript
const setCurrentWeek = (w: number) => {
  const week = Math.max(1, Math.min(40, w));
  _setCurrentWeek(week);
  props.onWeekChange?.(week);
  props.onTrimesterChange?.(getTrimester(week));
  props.onBabySizeChange?.(getBabySize(week));
};
```

### 3.3 dueDate from store

Read `dueDate` from `pregnancyModeStore` instead of hardcoded `new Date(2026, 1, 15)`. This allows the due-date form in `PregnancyProfileScreen` to feed into the store and be reflected here.

---

## 4. Calendar tab — pregnancy variant

### 4.1 Create `PregnancyCalendarScreen.tsx`

New screen at `src/screens/pregnancy/PregnancyCalendarScreen.tsx`. Shows:

```
┌──────────────────────────────┐
│  January 2026                │
│  Week 14 · Trimester 1       │
│                               │
│  [1st Tri] [2nd Tri] [3rd Tri]
│                               │
│  Month view with week numbers │
│  (cycles are replaced with    │
│   week-of-pregnancy)          │
│                               │
│  ┌─ Week 14 ─────────────────┐│
│  │ Baby: Poppy seed 🌱       ││
│  │ Trimester 1                ││
│  │ Due: Feb 15, 2026          ││
│  │ ───────────────────────── ││
│  │ Kick Counter ►             ││
│  │ Log Symptoms ►             ││
│  └────────────────────────────┘│
│                               │
│        [Pregnancy Dashboard]   │
└──────────────────────────────┘
```

**Content:**
- Header: month/year, "Week {n} · Trimester {t}"
- Trimester pills as phase markers
- Simple week grid (4×10 weeks layout, highlight current week)
- Selected week's detail card: baby size, trimester info, due date countdown
- Action buttons: Kick Counter, Log Symptoms (navigate to PregnancyDailyLog)
- Bottom button: "Pregnancy Dashboard" (navigates to PregnancyHome)

### 4.2 CalendarScreenRouter

Same pattern as Home — create `CalendarScreenRouter` that conditionally renders `PregnancyCalendarScreen` or `CalendarScreen`:

```tsx
function CalendarScreenRouter() {
  const isActive = usePregnancyModeStore((s) => s.isActive);
  return isActive ? <PregnancyCalendarScreen /> : <CalendarScreen />;
}
```

### 4.3 CalendarStack change

Replace `CalendarScreen` with `CalendarScreenRouter` as the initial screen.

---

## 5. Navigation structure

### 5.1 No tab changes

Bottom tabs remain: Home, Calendar, Analytics, Wellness, Profile. Labels unchanged.

### 5.2 Deep links preserved

`go('Home')` and `go('Calendar')` still work — the router handles the conditional render. `HomeDashboardScreen` is still accessible via the router when pregnancy mode is OFF.

### 5.3 PregnancyStack standalone

`PregnancyStack` remains defined in `FeatureStacks.tsx` for deep-link access from pregnancy UI elements (e.g., "Pregnancy Dashboard" button navigates to `PregnancyHome` using the stack).

---

## 6. Luna message

### 6.1 Pass pregnancyMode to LunaOverlay

`HomeScreenRouter` passes `pregnancyMode` and week/trimester/babySize to `LunaOverlay`:

```tsx
{isFocused && lunaEnabled && (
  <LunaOverlay
    screen="home"
    pregnancyMode={isActive}
    week={currentWeek}
    trimester={getTrimester(currentWeek)}
    babySize={getBabySize(currentWeek).fruit}
  />
)}
```

Where `currentWeek` comes from `pregnancyModeStore`.

### 6.2 LunaContext already handles it

`lunaContext.ts` lines 34-40 already has pregnancy mode handling:

```typescript
case 'home':
  if (opts.pregnancyMode && opts.week !== undefined) {
    return {
      animation: 'bounce',
      message: `Baby is ${opts.babySize ?? 'growing'} this week! You're in trimester ${opts.trimester ?? 1} 👶`,
      actionLabel: 'View milestones',
    };
  }
```

No changes needed to LunaOverlay or lunaContext — just wiring the props.

---

## 7. Files changed

| File | Change |
|---|---|
| `src/stores/pregnancyModeStore.ts` | **NEW** — Zustand store |
| `src/screens/profile/SettingsScreen.tsx` | Fix toggle, move to own PREGNANCY section |
| `src/screens/pregnancy/PregnancyHomeScreen.tsx` | Add callback props, read dueDate from store |
| `src/screens/pregnancy/PregnancyCalendarScreen.tsx` | **NEW** — pregnancy calendar view |
| `src/navigation/HomeStack.tsx` | Swap `HomeDashboardScreen` → `HomeScreenRouter` |
| `src/navigation/CalendarStack.tsx` | Swap `CalendarScreen` → `CalendarScreenRouter` |
| `src/screens/home/HomeDashboardScreen.tsx` | Wire pregnancyMode + week to LunaOverlay |

---

## 8. Test plan

```bash
cd mobile
npx tsc --noEmit            # zero new errors
```

**Visual checks:**
1. Settings → Pregnancy Mode toggle — turns ON
2. Home tab — shows pregnancy content (week, baby size, trimester info)
3. Calendar tab — shows pregnancy calendar (week grid, trimester pills)
4. Luna cat — speech bubble says "Baby is Poppy seed this week!"
5. Toggle OFF — Home/Calendar revert to cycle content immediately
6. On restart, toggle state persists

## 9. Assertions

- [ ] Toggle in Settings reads/writes `pregnancyModeStore.isActive`
- [ ] HomeScreenRouter renders PregnancyHomeScreen when active, HomeDashboardScreen when not
- [ ] PregnancyHomeScreen fires `onWeekChange` on week navigation
- [ ] CalendarScreenRouter renders PregnancyCalendarScreen when active, CalendarScreen when not
- [ ] PregnancyCalendarScreen shows week grid, trimester pills, due date
- [ ] Luna bubble updates to pregnancy text when mode is active
- [ ] `npx tsc --noEmit` — zero new errors
