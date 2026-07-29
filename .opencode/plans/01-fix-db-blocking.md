# Fix 1: Remove synchronous `initialData` from query hooks

**Problem:** 12 React Query hooks use `initialData: () => placeholder*()` which calls `getNativeDb().getAllSync()` synchronously during component render, blocking the UI thread on every screen that uses these hooks.

**Affected files & changes:**

## `mobile/src/services/queries/cycle.ts`
- **Line 11:** Remove `import { placeholderCycleEntries, placeholderCyclePredictions, placeholderCycleCalendar } from 'src/services/localDb/syncPlaceholders';`
- **Lines 27-28:** Remove `initialData: () => placeholderCycleEntries(params?.limit) as any,`
- **Lines 113-114:** Remove `initialData: () => placeholderCyclePredictions() as any,`
- **Lines 130-131:** Remove `initialData: () => placeholderCycleCalendar() as any,`

## `mobile/src/services/queries/family.ts`
- **Line 4:** Remove `import { placeholderFamilyLinks } from 'src/services/localDb/syncPlaceholders';`
- **Lines 16-17:** Remove `initialData: () => placeholderFamilyLinks() as any,`

## `mobile/src/services/queries/pregnancy.ts`
- **Lines 8-11:** Remove:
  ```
  import {
    placeholderPregnancyProfile,
    placeholderPregnancyMilestones,
  } from 'src/services/localDb/syncPlaceholders';
  ```
- **Lines 26-27:** Remove `initialData: () => placeholderPregnancyProfile() as any,`
- **Lines 66-67:** Remove `initialData: () => placeholderPregnancyMilestones() as any,`

## `mobile/src/services/queries/safety.ts`
- **Lines 13-17:** Remove:
  ```
  import {
    placeholderEmergencyContacts,
    placeholderActiveSos,
    placeholderSosHistory,
  } from 'src/services/localDb/syncPlaceholders';
  ```
- **Lines 36-37:** Remove `initialData: () => placeholderEmergencyContacts() as any,`
- **Lines 182-183:** Remove `initialData: () => placeholderActiveSos() as any,`
- **Lines 191-192:** Remove `initialData: () => placeholderSosHistory() as any,`

## `mobile/src/services/queries/wellness.ts`
- **Lines 12-16:** Remove:
  ```
  import {
    placeholderJournalEntries,
    placeholderMoodLogs,
    placeholderInsights,
  } from 'src/services/localDb/syncPlaceholders';
  ```
- **Lines 31-32:** Remove `initialData: () => placeholderJournalEntries(params?.per_page) as any,`
- **Lines 75-76:** Remove `initialData: () => placeholderMoodLogs(params?.per_page) as any,`
- **Lines 156-157:** Remove `initialData: () => placeholderInsights() as any,`

**Effect:** Queries will now start with `isLoading=true` and show loading skeletons. No synchronous SQLite reads block the UI thread.

**Verification:** Ensure all screens that use these hooks have Skeleton/ActivityIndicator for the `isLoading` state. CycleDashboardScreen already has one (lines 257-267). CycleHistoryScreen already has one (from prev fix).
