# Fix 6: Add missing loading states

**Problem:** Some screens show blank/empty state before data loads because they lack Skeleton or ActivityIndicator for the `isLoading` phase of React Query.

**Audit needed:** Check each screen that uses query hooks with `initialData` removed (Fix 1) to ensure it shows a loading state.

**Screens to check:**

1. **LogPeriodScreen** — Uses `useCreateCycleEntry` (mutation, no loading needed on mount)
2. **CycleDashboardScreen** — Already has Skeleton (lines 257-267) ✓
3. **CycleHistoryScreen** — Already has Skeleton (from prev fix) ✓
4. **HealthHubScreen** — Check if it uses any data queries
5. **Companion screens** — Check for missing loading states
6. **Wellness screens** — Journal lists, mood logs — check for loading skeletons
7. **Safety screens** — Emergency contacts, SOS — check for loading states
8. **Pregnancy screens** — Daily log, milestones — check for loading states
9. **Family screens** — Family links — check for loading states

**For any screen missing a loading state, add:**
```tsx
if (isLoading) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Skeleton height={120} style={{ marginBottom: 16 }} />
        <Skeleton height={80} />
      </ScrollView>
    </SafeAreaView>
  );
}
```

**Effect:** Users see a skeleton placeholder instead of a blank/empty screen while data loads.

**Note:** This fix depends on the audit results. Run the app and check each screen that had `initialData` removed to confirm loading states exist.
