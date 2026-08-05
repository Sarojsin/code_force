# Performance Fixes — Execution Plan

## Fix 1: Remove synchronous `initialData` from query hooks (DB blocking)
**Files to edit:** 5 query files, 12 hooks total

### `services/queries/cycle.ts`
- Line 11: Remove `import { placeholderCycleEntries, placeholderCyclePredictions, placeholderCycleCalendar }`
- Line 27: Remove `initialData: () => placeholderCycleEntries(params?.limit) as any,`
- Line 113: Remove `initialData: () => placeholderCyclePredictions() as any,`
- Line 130: Remove `initialData: () => placeholderCycleCalendar() as any,`

### `services/queries/family.ts`
- Line 4: Remove `import { placeholderFamilyLinks }`
- Line 16: Remove `initialData: () => placeholderFamilyLinks() as any,`

### `services/queries/pregnancy.ts`
- Lines 8-11: Remove `placeholderPregnancyProfile, placeholderPregnancyMilestones` import
- Line 26: Remove `initialData: () => placeholderPregnancyProfile() as any,`
- Line 66: Remove `initialData: () => placeholderPregnancyMilestones() as any,`

### `services/queries/safety.ts`
- Lines 13-17: Remove `placeholderEmergencyContacts, placeholderActiveSos, placeholderSosHistory` import
- Line 36: Remove `initialData: () => placeholderEmergencyContacts() as any,`
- Line 182: Remove `initialData: () => placeholderActiveSos() as any,`
- Line 191: Remove `initialData: () => placeholderSosHistory() as any,`

### `services/queries/wellness.ts`
- Lines 12-16: Remove `placeholderJournalEntries, placeholderMoodLogs, placeholderInsights` import
- Line 31: Remove `initialData: () => placeholderJournalEntries(params?.per_page) as any,`
- Line 75: Remove `initialData: () => placeholderMoodLogs(params?.per_page) as any,`
- Line 156: Remove `initialData: () => placeholderInsights() as any,`

## Fix 2: LogPeriodScreen transition lag
**File:** `screens/cycle/LogPeriodScreen.tsx`
- Line 5: Add `useMemo` to React import: `import React, { useState, useMemo } from 'react';`
- Line 63: Wrap component in `React.memo`: `export const LogPeriodScreen = React.memo(function LogPeriodScreen() {`
- Lines 66-69: Replace `useForm` defaultValues:
  ```tsx
  const defaultValues = useMemo(() => ({ startDate: new Date().toISOString().slice(0, 10), notes: '' }), []);
  const { control, handleSubmit, formState } = useForm<LogPeriodForm>({
    resolver: zodResolver(logPeriodSchema),
    defaultValues,
    mode: 'onBlur',
  });
  ```

## Fix 3: Bottom navigation delay (freezeOnBlur)
**File:** `navigation/MainTabs.tsx`
- Line 95: Add `freezeOnBlur: true,` after `headerShown: false,`

## Fix 4: Calendar redrawing
**File:** `components/ui/Calendar.tsx`
- Line 55: Wrap export with `React.memo`: `export const Calendar = React.memo(function Calendar({`
- Lines 69-70: Wrap canGoPrev/canGoNext in useMemo:
  ```tsx
  const canGoPrev = useMemo(() => !minDate || subMonths(currentMonth, 1) >= startOfMonth(minDate), [currentMonth, minDate]);
  const canGoNext = useMemo(() => !maxDate || addMonths(currentMonth, 1) <= endOfMonth(maxDate), [currentMonth, maxDate]);
  ```
- Lines 112-175: Wrap day grid in useMemo:
  ```tsx
  const dayGrid = useMemo(() => Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIdx) => (
    <View key={weekIdx} style={styles.weekRow} accessibilityRole="list">
      {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, dayIdx) => {
        // ... existing cell render logic
      })}
    </View>
  )), [days, selectedDate, markedDates, minDate, maxDate, encodedDays, animatingDates, onDateSelect, theme]);
  ```
- Then in JSX replace the inline loop with `{dayGrid}`

**File:** `screens/cycle/CycleDashboardScreen.tsx`
- Line 1: Add `useMemo, useCallback` to React import if needed
- Lines 170-171: Add stable refs:
  ```tsx
  const todayRef = useRef(new Date());
  const noopRef = useRef(() => {});
  ```
  Replace line 375:
  ```tsx
  <Calendar selectedDate={todayRef.current} onDateSelect={noopRef.current} encodedDays={calData?.days} />
  ```

## Fix 5: Zustand full-store subscriptions
**File:** `navigation/RootNavigator.tsx` (line 33)
- Replace: `const { user, isHydrated, hydrate } = useAuthStore();`
- With: `const user = useAuthStore((s) => s.user); const isHydrated = useAuthStore((s) => s.isHydrated); const hydrate = useAuthStore((s) => s.hydrate);`

**File:** `screens/cycle/CycleDashboardScreen.tsx` (line 135)
- Replace: `const endDateStore = useEndDateStore();`
- With selective selectors for each usage:
  ```
  const entryId = useEndDateStore((s) => s.entryId);
  const periodStartDate = useEndDateStore((s) => s.periodStartDate);
  const notificationId = useEndDateStore((s) => s.notificationId);
  const clearPending = useEndDateStore((s) => s.clearPending);
  const setPending = useEndDateStore((s) => s.setPending);
  ```
  Then update all references from `endDateStore.xxx` to use the individual variables.

**File:** `screens/companion/HealthHubScreen.tsx` (line 84)
- Replace destructuring with individual selectors

**File:** `screens/dev/OfflineDashboardScreen.tsx` (line 16)
- Replace `const metrics = useSyncMetricsStore();` with individual selectors for only the fields used

## Fix 6: Missing loading states
- Audit `screens/` for any screen that lacks Skeleton/ActivityIndicator when query is loading
- Add SkeletonPlaceholder to blank states
