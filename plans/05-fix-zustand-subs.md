# Fix 5: Replace full-store Zustand subscriptions with selective selectors

**Problem:** 4 components call `useStore()` without a selector, subscribing to ALL state changes in that store. This causes unnecessary re-renders when unrelated fields change.

## File 1: `mobile/src/navigation/RootNavigator.tsx` (line 33)

**Change — Replace full-store destructuring with selective selectors:**
```
OLD:  const { user, isHydrated, hydrate } = useAuthStore();
NEW:  const user = useAuthStore((s) => s.user);
      const isHydrated = useAuthStore((s) => s.isHydrated);
      const hydrate = useAuthStore((s) => s.hydrate);
```

## File 2: `mobile/src/screens/cycle/CycleDashboardScreen.tsx` (line 135)

**Change — Replace full-store with individual selectors:**
```
OLD:  const endDateStore = useEndDateStore();
NEW:  const entryId = useEndDateStore((s) => s.entryId);
      const periodStartDate = useEndDateStore((s) => s.periodStartDate);
      const notificationId = useEndDateStore((s) => s.notificationId);
      const avgPeriodLength = useEndDateStore((s) => s.avgPeriodLength);
      const clearPending = useEndDateStore((s) => s.clearPending);
      const setPending = useEndDateStore((s) => s.setPending);
      const setNotificationId = useEndDateStore((s) => s.setNotificationId);
```

Then update all references:
- `endDateStore.entryId` → `entryId`
- `endDateStore.periodStartDate` → `periodStartDate`
- `endDateStore.notificationId` → `notificationId`
- `endDateStore.avgPeriodLength` → `avgPeriodLength`
- `endDateStore.clearPending()` → `clearPending()`
- `endDateStore.setPending(...)` → `setPending(...)`
- `endDateStore.setNotificationId(...)` → `setNotificationId(...)`

References in CycleDashboardScreen.tsx:
- Line 138: `endDateStore.periodStartDate` → `periodStartDate`
- Line 220: `endDateStore.entryId` → `entryId`
- Line 224: `endDateStore.notificationId` → `notificationId`
- Line 225: `endDateStore.clearPending()` → `clearPending()`
- Line 234: `endDateStore.notificationId` → `notificationId`
- Line 235: `endDateStore.clearPending()` → `clearPending()`
- Line 239: `endDateStore.periodStartDate` → `periodStartDate`
- Line 332: `endDateStore.periodStartDate` → `periodStartDate`
- Line 438: `endDateStore.periodStartDate` → `periodStartDate`

## File 3: `mobile/src/screens/companion/HealthHubScreen.tsx`

**Change — Replace full-store with individual selectors (line 84):**
First, read the file to see which fields are destructured. Then replace:
```
OLD:  } = useHealthMetricsStore();
NEW:  /* individual selectors for each destructured field */
```

## File 4: `mobile/src/screens/dev/OfflineDashboardScreen.tsx` (line 16)

**Change — Replace full-store individual selectors:**
First, read the file to see which `metrics` properties are used. Then replace:
```
OLD:  const metrics = useSyncMetricsStore();
NEW:  const /* specific fields */ = useSyncMetricsStore((s) => s.xxx);
```

**Effect:** Components only re-render when the specific fields they use change, not on every store update.
