# Architecture Phase 0: Complete Implementation Plan

**Consolidated action plan from Phases 1–5.** Read this to understand every file change, in what order, and how to verify.

---

## 1. Phase Dependency Map

```
Phase 1 (3 days) — Offline Queue + Cache Persistence
  ├── 1a: Wire 11 mutation hooks to offlineStore.enqueue()
  └── 1b: Enable persistQueryClient with AsyncStorage
  │
  ▼
Phase 2 (2.5 days) — SOS SMS Fallback + Cycle/Period Features
  ├── 2a: SOSActiveScreen → SMS fallback + enqueue resolve/cancel
  ├── 2b: CycleDashboardScreen → model updater on Wi-Fi
  └── 2c: LogPeriodScreen → wire useCreateCycleEntry
  │
  ▼
Phase 3 (1.5 days) — UI Polish + Network-Aware UX
  ├── 3a: ConnectivityBanner with real queue count + 500ms fade-out
  ├── 3b: useNetworkAwareQuery (isOffline/isServerError built-in)
  └── 3c: ErrorBoundary wrapping RootNavigator (not AppProviders)
  │
  ├──────────────────────────────────────┐
  ▼                                      ▼
Phase 4 (3 days)                   Phase 5 (2 days)
Testing + CI Gate                  Monitoring + Observability
  ├── Unit tests                      ├── Structured sync logging
  ├── Integration tests               ├── Sentry breadcrumbs + PII sanitization
  ├── E2E (Detox) with launch args    ├── syncMetricsStore
  └── GitHub Actions + Husky          └── OfflineDashboard (dev-only)
```

Phases 4 and 5 are independent and can run in parallel after Phases 1–3 land.

---

## 2. Complete File Change Inventory

### Phase 1 — 14 files

| # | File | Change |
|---|------|--------|
| 1 | `src/services/sync/isNetworkError.ts` | **New** — Helper to classify errors (network vs validation) |
| 2 | `src/services/utils/generateId.ts` | **New** — `crypto.randomUUID()` with RFC 4122 fallback |
| 3 | `src/services/sync/queryKeyMapper.ts` | **New** — Maps operation types to React Query keys for 409 conflict handling |
| 4 | `src/services/queries/cycle.ts` | Modify `useCreateCycleEntry`, `useUpdateCycleEntry`, `useLogCorrection`, `useLogSnooze` — add offline enqueue + optimistic updates |
| 5 | `src/services/queries/wellness.ts` | Modify `useCreateJournalEntry`, `useCreateMoodLog`, `useCompleteBreathingSession` — add offline enqueue + optimistic updates |
| 6 | `src/services/queries/safety.ts` | Modify `useCreateEmergencyContact`, `useUpdateEmergencyContact`, `useDeleteEmergencyContact`, `useTriggerSos` — add offline enqueue + optimistic updates |
| 7 | `src/app/providers.tsx` | Modify — import `persistQueryClient`, `createAsyncStoragePersister`, configure `staleTime`/`gcTime`/`networkMode`, call `persistQueryClient` |
| 8 | `src/services/sync/syncEngine.ts` | Modify — add 409 conflict handler with `inferQueryKey()` and `qc.setQueryData()` overwrite |

### Phase 2 — 5 files

| # | File | Change |
|---|------|--------|
| 9 | `src/screens/safety/SOSActiveScreen.tsx` | Modify — add `getLocation()` with GPS + cached fallback, `sendSmsFallback()`, `enqueueResolve()`, `enqueueCancel()`, real user name from auth store |
| 10 | `src/services/safetySyncQueue.ts` | Modify — add `enqueueResolve(sosId)`, `enqueueCancel(sosId)`, update `syncQueue()` to dispatch by type |
| 11 | `src/app/App.tsx` | Modify — add `updateLastKnownLocation()` on foreground for cached GPS |
| 12 | `src/screens/cycle/CycleDashboardScreen.tsx` | Modify — add `modelUpdater.checkForUpdate()` on mount + Wi-Fi connect |
| 13 | `src/screens/cycle/LogPeriodScreen.tsx` | Modify — replace `logger.info` stub with `useCreateCycleEntry()` mutation call |

### Phase 3 — 4 files

| # | File | Change |
|---|------|--------|
| 14 | `src/components/ui/ConnectivityBanner.tsx` | Modify — show real queue count from `useOfflineStore`, 500ms fade-out on reconnect |
| 15 | `src/services/queries/useNetworkAwareQuery.ts` | **New** — wrapper hook returning `hasContent`, `isOffline`, `isServerError` computed from `useNetworkStatus` + error classifier |
| 16 | `src/components/ui/ErrorBoundary.tsx` | **New** — class component wrapping only `RootNavigator` (not `AppProviders`) |
| 17 | `src/components/ui/ErrorState.tsx` | **New** — offline-aware error state with retry button |

### Phase 4 — 8 files

| # | File | Change |
|---|------|--------|
| 18 | `src/services/sync/__tests__/isNetworkError.test.ts` | **New** — 6 test cases for `isNetworkError` |
| 19 | `src/stores/__tests__/offlineStore.test.ts` | Modify — extend with `enqueue`, `remove`, `getPendingOperations`, `hydrate` tests |
| 20 | `src/services/sync/__tests__/syncEngine.test.ts` | **New** — tests for `syncAll`, push/pull, conflict handling |
| 21 | `src/app/__tests__/providers.test.ts` | **New** — test that `persistQueryClient` restores cached data from AsyncStorage |
| 22 | `src/services/queries/__tests__/wellness.test.ts` | **New** — integration test pattern for mutation hooks |
| 23 | `mobile/e2e/offline.test.ts` | **New** — Detox E2E: offline journal, SOS SMS, force-quit cache |
| 24 | `.github/workflows/mobile-ci.yml` | **New** — GitHub Actions CI with TypeScript, lint, jest, bundle check |
| 25 | `.husky/pre-commit` + `.lintstagedrc.json` | **New** — pre-commit hooks |

### Phase 5 — 6 files

| # | File | Change |
|---|------|--------|
| 26 | `src/services/sync/syncEngine.ts` | Modify — add structured logging (`sync.cycle.starting/completed/failed`) + Sentry scope tagging with PII-safe `extra.pending_ops` |
| 27 | `src/stores/offlineStore.ts` | Modify — add logging to `enqueue` and `discard` |
| 28 | `src/services/sync/sentrySyncBreadcrumbs.ts` | **New** — `initSyncBreadcrumbs()` subscribing to `offlineStore` |
| 29 | `src/services/queries/offlineMutationWrapper.ts` | **New** — `addOfflineBreadcrumb()` with `sanitizeData()` redacting PII fields |
| 30 | `src/stores/syncMetricsStore.ts` | **New** — Zustand + AsyncStorage persisted metrics |
| 31 | `src/screens/dev/OfflineDashboardScreen.tsx` | **New** — dev-only screen with queue, metrics, network, Force Sync button wired to `syncAll()` |

**Total: 31 files** (14 new, 17 modified)

---

## 3. Phase 1 Implementation Details

### 3.1 Create `isNetworkError.ts`

```typescript
// src/services/sync/isNetworkError.ts
import { AxiosError } from 'axios';

export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    if (!error.response) return true;
    if (error.response.status >= 500) return true;
    return false;
  }
  if (error instanceof TypeError && error.message === 'Network request failed') {
    return true;
  }
  return false;
}
```

### 3.2 Create `generateId.ts`

```typescript
// src/services/utils/generateId.ts
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

### 3.3 Create `queryKeyMapper.ts`

```typescript
// src/services/sync/queryKeyMapper.ts
const TYPE_TO_QUERY_KEY: Record<string, string[]> = {
  'journal/create': ['wellness', 'journal'],
  'journal/update': ['wellness', 'journal'],
  'mood/create':    ['wellness', 'moodLogs'],
  'cycle/create':   ['cycle', 'entries'],
  'cycle/update':   ['cycle', 'entries'],
  'cycle/correction': ['cycle', 'calendar', 'cycle', 'predictions'],
  'cycle/snooze':   ['cycle', 'calendar'],
  'breathing/complete': ['wellness', 'breathing'],
  'safety/contact/create': ['safety', 'contacts'],
  'safety/contact/update': ['safety', 'contacts'],
  'safety/contact/delete': ['safety', 'contacts'],
  'safety/sos/trigger': ['safety', 'activeSos', 'safety', 'sosHistory'],
};

export function inferBaseQueryKey(type: string): string[] {
  return TYPE_TO_QUERY_KEY[type] ?? [];
}

export function inferQueryKey(type: string, entityId: string): string[] {
  const base = TYPE_TO_QUERY_KEY[type];
  if (!base) return [];
  return [...base, entityId];
}
```

### 3.4 Modify 11 Mutation Hooks

All changes follow this exact pattern. Add to each hook's `onError`:

```typescript
onError: (error) => {
  if (isNetworkError(error)) {
    offlineStore.enqueue({
      type: '<type_label>',           // See table §3.5
      endpoint: '<api_endpoint>',      // See table §3.5
      data,
      tempId: generateId(),
      idempotencyKey: generateId(),
      clientUpdatedAt: new Date().toISOString(),
      priority: '<priority>',
    });
    Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
    // Optimistic update
    qc.setQueryData(queryKeys, (old: any) => {
      if (!old) return [{ ...data, id: tempId, _optimistic: true }];
      if (Array.isArray(old)) return [{ ...data, id: tempId, _optimistic: true }, ...old];
      return old;
    });
  } else {
    Toast.show({ type: 'error', text1: getErrorMessage(error) });
  }
},
```

### 3.5 Hook → Type Label Mapping Table

| File | Hook | Type Label | Endpoint | Priority |
|------|------|-----------|----------|----------|
| `cycle.ts` | `useCreateCycleEntry` | `cycle/create` | `POST /cycle/entries` | normal |
| `cycle.ts` | `useUpdateCycleEntry` | `cycle/update` | `PUT /cycle/entries/{id}` | normal |
| `cycle.ts` | `useLogCorrection` | `cycle/correction` | `POST /cycle/corrections` | normal |
| `cycle.ts` | `useLogSnooze` | `cycle/snooze` | `POST /cycle/snooze` | low |
| `wellness.ts` | `useCreateJournalEntry` | `journal/create` | `POST /wellness/journal` | normal |
| `wellness.ts` | `useCreateMoodLog` | `mood/create` | `POST /wellness/mood` | normal |
| `wellness.ts` | `useCompleteBreathingSession` | `breathing/complete` | `POST /wellness/breathing/complete` | low |
| `safety.ts` | `useCreateEmergencyContact` | `safety/contact/create` | `POST /safety/emergency-contacts` | normal |
| `safety.ts` | `useUpdateEmergencyContact` | `safety/contact/update` | `PUT /safety/emergency-contacts/{id}` | normal |
| `safety.ts` | `useDeleteEmergencyContact` | `safety/contact/delete` | `DELETE /safety/emergency-contacts/{id}` | normal |
| `safety.ts` | `useTriggerSos` | `safety/sos/trigger` | `POST /safety/sos/trigger` | **high** |

### 3.6 Modify `providers.tsx` — persistQueryClient

```typescript
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'REACT_QUERY_OFFLINE_CACHE',
  throttleTime: 1000,
});

// Modify existing QueryClient config
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const status = error?.response?.status;
        if (status === 401 || status === 404) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 5,    // 5 min
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 0,
      networkMode: 'offlineFirst',
    },
  },
});

// Call after queryClient creation
persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  buster: 'v1',
});
```

### 3.7 Modify `syncEngine.ts` — 409 Conflict Handler

In the batch results processing loop, add this conflict branch:

```typescript
if (result.status === 'conflict') {
  offlineStore.remove(id);

  if (result.server_data && result.entity_id) {
    const queryKey = inferQueryKey(op.type, result.entity_id);

    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      if (Array.isArray(old)) {
        return old.map((item: any) =>
          item.id === result.entity_id || item.id === op.tempId
            ? { ...result.server_data, _conflict_resolved: true }
            : item
        );
      }
      return old;
    });

    queryClient.invalidateQueries({ queryKey: inferBaseQueryKey(op.type) });
  }
}
```

---

## 4. Phase 2 Implementation Details

### 4.1 Modify `SOSActiveScreen.tsx`

Add these imports and helper function:

```typescript
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendSmsFallback } from 'src/services/api/safety';
import { enqueueSos, enqueueResolve, enqueueCancel } from 'src/services/safetySyncQueue';
import { useEmergencyContacts } from 'src/services/queries';
import { useAuthStore } from 'src/stores/authStore';

const LAST_LOCATION_KEY = 'shecare.last_known_location';

async function getLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
    });
    await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location.coords)).catch(() => {});
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    };
  } catch {
    try {
      const cached = await AsyncStorage.getItem(LAST_LOCATION_KEY);
      if (cached) return { ...JSON.parse(cached), accuracy: null };
    } catch {}
    return null;
  }
}
```

Inside `handleTriggerSos`:

```typescript
const user = useAuthStore(state => state.user);
const { data: contacts } = useEmergencyContacts();

const handleTriggerSos = async () => {
  const location = await getLocation();
  const data = {
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    location_accuracy_m: location?.accuracy ?? null,
    trigger_source: 'button' as const,
  };
  const userName = user?.display_name || user?.email || 'Someone';

  try {
    await triggerMutation.mutateAsync({ data, idempotencyKey });
    setPhase('active');
  } catch (err) {
    await enqueueSos(data).catch(() => {});
    if (contacts && contacts.length > 0) {
      sendSmsFallback(contacts.map(c => c.phone_number), userName, location ?? undefined);
    }
    Toast.show({ type: 'success', text1: 'SOS sent via SMS to your emergency contacts' });
    setPhase('active');
  }
};
```

Wire `handleImSafe` and `handleCancelSos` to call `enqueueResolve()` / `enqueueCancel()` on error.

### 4.2 Modify `safetySyncQueue.ts`

Add these two new functions:

```typescript
export async function enqueueResolve(sosId: string): Promise<void> {
  const queue = await getQueue();
  queue.push({
    id: generateId(),
    type: 'safety/sos/resolve',
    endpoint: `/api/v1/safety/sos/${sosId}/resolve`,
    data: { sos_id: sosId },
    tempId: generateId(),
    idempotencyKey: generateId(),
    clientUpdatedAt: new Date().toISOString(),
    priority: 'high',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  await saveQueue(queue);
}

export async function enqueueCancel(sosId: string): Promise<void> {
  const queue = await getQueue();
  queue.push({
    id: generateId(),
    type: 'safety/sos/cancel',
    endpoint: `/api/v1/safety/sos/${sosId}/cancel`,
    data: { sos_id: sosId, false_alarm: true },
    tempId: generateId(),
    idempotencyKey: generateId(),
    clientUpdatedAt: new Date().toISOString(),
    priority: 'high',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  await saveQueue(queue);
}
```

Update `syncQueue()` to dispatch `safety/sos/resolve` → `safetyService.resolveSos()` and `safety/sos/cancel` → `safetyService.cancelSos()`.

### 4.3 Modify `App.tsx` — Last Known Location Cache

```typescript
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_LOCATION_KEY = 'shecare.last_known_location';

async function updateLastKnownLocation(): Promise<void> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
      timeInterval: 60000,
    });
    await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(loc.coords));
  } catch { /* silent */ }
}

// Inside App component:
useEffect(() => {
  const sub = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') updateLastKnownLocation();
  });
  updateLastKnownLocation();
  return () => sub.remove();
}, []);
```

### 4.4 Modify `CycleDashboardScreen.tsx`

```typescript
import { modelUpdater } from 'src/services/ml';

export function CycleDashboardScreen() {
  useEffect(() => {
    globalModelClient.ensureLatest().catch(() => null);
  }, []);

  useEffect(() => {
    if (isConnected) {
      modelUpdater.checkForUpdate().then((result) => {
        if (result.wellness || result.minilm) {
          Toast.show({ type: 'success', text1: 'Wellness model updated' });
        }
      }).catch(() => {});
    }
  }, [isConnected]);
}
```

### 4.5 Modify `LogPeriodScreen.tsx`

```typescript
import { useCreateCycleEntry } from 'src/services/queries';
import Toast from 'react-native-toast-message';

export function LogPeriodScreen() {
  const { mutate: createEntry, isPending } = useCreateCycleEntry();

  const onSubmit = async (data: LogPeriodForm) => {
    createEntry({
      period_start_date: data.startDate,
      period_end_date: data.endDate || undefined,
      flow_intensity: selectedFlow,
      symptoms: selectedSymptoms,
      mood_tags: selectedMoods,
      energy_level: energyLevel,
      notes: data.notes,
    }, {
      onSuccess: () => navigation.goBack(),
      onError: () => {}, // Phase 1 handles offline toast
    });
  };

  // In JSX:
  // <Button label={isPending ? 'Saving...' : 'Save period log'}
  //         onPress={handleSubmit(onSubmit)}
  //         disabled={!formState.isValid || isPending} />
}
```

---

## 5. Phase 3 Implementation Details

### 5.1 Modify `ConnectivityBanner.tsx`

```typescript
import { useOfflineStore } from 'src/stores/offlineStore';
import { useNetworkStatus } from 'src/services/sync';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useEffect, useRef } from 'react';

export function ConnectivityBanner() {
  const { isConnected } = useNetworkStatus();
  const pendingCount = useOfflineStore((s) => s.operations.length);
  const [visible, setVisible] = useState(!isConnected);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isConnected) {
      // 500ms fade-out on reconnect
      timerRef.current = setTimeout(() => setVisible(false), 500);
    } else {
      setVisible(true);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isConnected]);

  if (!visible) return null;

  const message = pendingCount > 0
    ? `You're offline — ${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} will sync when connected`
    : "You're offline — your data will sync when you reconnect";

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)}
      style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}
```

### 5.2 Create `useNetworkAwareQuery.ts`

```typescript
// src/services/queries/useNetworkAwareQuery.ts
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useNetworkStatus } from 'src/services/sync';
import { isNetworkError } from 'src/services/sync/isNetworkError';
import { useCallback } from 'react';

interface NetworkAwareResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  hasContent: boolean;
  isOffline: boolean;
  isServerError: boolean;
  refetch: () => Promise<any>;
}

export function useNetworkAwareQuery<T>(
  options: UseQueryOptions<T> & { queryKey: any[]; queryFn: any }
): NetworkAwareResult<T> {
  const { isConnected } = useNetworkStatus();
  const query = useQuery(options);

  const isOffline = !isConnected;
  const isServerError = query.error
    ? isNetworkError(query.error) && query.error instanceof Error
      ? false
      : !isConnected
        ? false
        : true
    : false;

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    hasContent: !!query.data && (Array.isArray(query.data) ? query.data.length > 0 : true),
    isOffline,
    isServerError,
    refetch: query.refetch,
  };
}
```

### 5.3 Create `ErrorBoundary.tsx`

```typescript
// src/components/ui/ErrorBoundary.tsx
import React, { Component, ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>We've been notified. Please restart the app.</Text>
          <TouchableOpacity style={styles.button} onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
```

Place in App tree:

```typescript
<AppProviders>
  <ConnectivityBanner />
  <ErrorBoundary>
    <RootNavigator />
  </ErrorBoundary>
  <Toast />
</AppProviders>
```

---

## 6. Phase 4 Implementation Details

### 6.1 Unit Tests

**`isNetworkError.test.ts`** — 6 cases: AxiosError no response (true), 500 (true), 404 (false), 422 (false), TypeError network (true), generic Error (false).

**`offlineStore.test.ts`** — Extend with: enqueue adds with correct shape, FIFO order, remove by id, `getPendingOperations` excludes maxed retries, hydrate restores from EncryptedStorage.

**`syncEngine.test.ts`** — Tests: skip if already syncing, skip if no auth, push + pull sequence, conflict handler overwrites cache.

**`providers.test.ts`** — Seed AsyncStorage with cache data, create new QueryClient + persistQueryClient, verify `getQueryData` returns restored data.

### 6.2 Integration Tests

Test all 11 mutation hooks for:

1. **Online path**: mock API success → `onSuccess` called, cache invalidation triggered
2. **Offline path**: mock `TypeError('Network request failed')` → `offlineStore.enqueue()` called with correct shape
3. **4xx path**: mock 422 validation error → `offlineStore.enqueue()` NOT called

### 6.3 E2E Tests (Detox)

Use `E2E_TEST_OFFLINE` launch arg instead of `device.setStatusBar`:

```typescript
const launchOffline = async () => {
  await device.launchApp({ newInstance: true, launchArgs: { E2E_TEST_OFFLINE: 'true' } });
};
const launchOnline = async () => {
  await device.launchApp({ newInstance: true, launchArgs: { E2E_TEST_OFFLINE: 'false' } });
};
```

Scenarios:
1. Offline → write journal → online → verify sync
2. Offline → SOS → verify SMS fallback
3. Load calendar online → `device.terminateApp()` → relaunch offline → verify cache loads

### 6.4 CI Configuration

**Coverage thresholds** (`.github/workflows/mobile-ci.yml`):

```yaml
run: npx jest --coverage --coverageThreshold='{"global":{"lines":80,"functions":80,"branches":75},"./src/services/queries/":{"lines":95,"functions":95}}'
```

---

## 7. Phase 5 Implementation Details

### 7.1 Structured Logging in `syncEngine.ts`

Add to `syncAll()`:
- `logger.info('sync.cycle.starting', { queue_size, user_id })` at start
- `logger.info('sync.push.starting/completed', { op_count, duration_ms })` during push
- `logger.info('sync.cycle.completed', { duration_ms, ops_pushed, ops_pulled, queue_size_before, queue_size_after })` on success
- `logger.error('sync.cycle.failed', { duration_ms, queue_size_before, error })` on failure

### 7.2 Sentry Breadcrumbs — PII-Safe

In `offlineMutationWrapper.ts`:

```typescript
const SENSITIVE_FIELDS = new Set([
  'content', 'notes', 'symptoms', 'mood_tags', 'flow_intensity', 'body', 'data',
]);

function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key)) { sanitized[key] = '[REDACTED]'; }
    else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeData(value as Record<string, unknown>);
    } else { sanitized[key] = value; }
  }
  return sanitized;
}

export function addOfflineBreadcrumb(type: string, data: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category: 'offline.mutation',
    message: `Offline ${type} queued`,
    level: 'info',
    data: { type, ...sanitizeData(data) },
  });
}
```

In `syncEngine.ts` Sentry error capture — NEVER include `o.data`:

```typescript
Sentry.captureException(error, {
  extra: {
    pending_ops: pendingToPush.map(o => ({
      id: o.id,
      type: o.type,
      priority: o.priority,
      retryCount: o.retryCount,
      // NOTE: o.data intentionally omitted — may contain PII
    })),
  },
});
```

### 7.3 Create `syncMetricsStore.ts`

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SyncMetrics {
  lastSyncAt: string | null;
  lastSyncDuration: number | null;
  lastSyncStatus: 'success' | 'failed' | null;
  totalOpsPushed: number;
  totalOpsPulled: number;
  totalSyncCycles: number;
  failedSyncCycles: number;
  maxQueueSize: number;
}

export const useSyncMetricsStore = create<SyncMetrics & { recordSync: Function; reset: Function }>()(
  persist(
    (set, get) => ({
      lastSyncAt: null, lastSyncDuration: null, lastSyncStatus: null,
      totalOpsPushed: 0, totalOpsPulled: 0, totalSyncCycles: 0, failedSyncCycles: 0, maxQueueSize: 0,
      recordSync: (status: 'success' | 'failed', duration: number, opsPushed: number, opsPulled: number, queueSize: number) => {
        const s = get();
        set({
          lastSyncAt: new Date().toISOString(), lastSyncDuration: duration, lastSyncStatus: status,
          totalOpsPushed: s.totalOpsPushed + opsPushed, totalOpsPulled: s.totalOpsPulled + opsPulled,
          totalSyncCycles: s.totalSyncCycles + 1,
          failedSyncCycles: s.failedSyncCycles + (status === 'failed' ? 1 : 0),
          maxQueueSize: Math.max(s.maxQueueSize, queueSize),
        });
      },
      reset: () => set({
        lastSyncAt: null, lastSyncDuration: null, lastSyncStatus: null,
        totalOpsPushed: 0, totalOpsPulled: 0, totalSyncCycles: 0, failedSyncCycles: 0, maxQueueSize: 0,
      }),
    }),
    { name: 'shecare.sync.metrics', storage: createJSONStorage(() => AsyncStorage) }
  ),
);
```

### 7.4 Create `OfflineDashboardScreen.tsx`

```typescript
import { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { syncAll } from 'src/services/sync/syncEngine';
import { useOfflineStore } from 'src/stores/offlineStore';
import { useSyncMetricsStore } from 'src/stores/syncMetricsStore';

export function OfflineDashboardScreen() {
  const operations = useOfflineStore((s) => s.operations);
  const metrics = useSyncMetricsStore();

  const handleForceSync = useCallback(async () => {
    Toast.show({ type: 'info', text1: 'Syncing...' });
    try {
      await syncAll();
      Toast.show({ type: 'success', text1: 'Sync completed' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Sync failed', text2: e?.message });
    }
  }, []);

  // Render: Network card, Queue card (with pending ops list), Metrics card, Action buttons
}

// In navigation — use require() inside __DEV__ block to prevent production bundling:
// if (__DEV__) {
//   const OfflineDashboardScreen = require('../screens/dev/OfflineDashboardScreen').default;
//   stack.Screen name="OfflineDashboard" component={OfflineDashboardScreen};
// }
```

---

## 8. Validation Checklist (All Phases)

### Phase 1 — Offline Queue + Cache

| # | Test | Expected |
|---|------|----------|
| 1 | Offline: write journal | "Saved offline" toast. Entry appears in list. |
| 2 | Offline: log mood | "Saved offline" toast. Mood appears in history. |
| 3 | Offline: trigger SOS | "Saved offline" toast. SOS shows as active. |
| 4 | Online: queue drains after 5s | Data appears on server. |
| 5 | Force-quit → reopen | Calendar loads instantly (no spinner). |
| 6 | Offline: open app | Previously fetched data visible (from cache). |
| 7 | Write entry offline → force-quit → reopen online | Entry syncs on reconnect. |
| 8 | Create 20 entries offline → come online | All 20 sync in one batch. |
| 9 | Edit entry offline → server edits same entry → online | Server data wins. No stale optimistic data. |
| 10 | Rapid offline creates | `crypto.randomUUID()` ensures no tempId collision. |

### Phase 2 — SOS + Cycle + Period

| # | Test | Expected |
|---|------|----------|
| 11 | Offline SOS trigger | Native SMS app opens with pre-filled message. |
| 12 | Offline SOS trigger | "SOS sent via SMS" toast. Screen shows "SOS ACTIVE". |
| 13 | Online SOS trigger | API succeeds. SMS app NOT opened. |
| 14 | Offline SOS → go online | Queue processes SOS record. |
| 15 | SOS with GPS permission | SMS contains actual GPS coordinates. |
| 16 | SOS without GPS permission | SMS says "Location unavailable — please call user". |
| 17 | SOS SMS shows user's real name | Not "User" — uses `display_name` from auth store. |
| 18 | Offline SOS → tap "I'm Safe" | Resolve queued. No further contact notifications. |
| 19 | Offline SOS → tap "Cancel" | Cancel queued. |
| 20 | Dashboard on Wi-Fi | Model versions checked, downloaded if stale. |
| 21 | Log period entry (online) | Calendar updates with new entry. |
| 22 | Log period entry (offline) | "Saved offline" toast. Entry visible in calendar. |

### Phase 3 — UI Polish

| # | Test | Expected |
|---|------|----------|
| 23 | Offline, 3 pending operations | Banner: "You're offline — 3 changes will sync when connected". |
| 24 | Offline → online | Banner fades out over 500ms (no flicker). |
| 25 | Offline, no pending | Banner: "You're offline — your data will sync when you reconnect". |
| 26 | First launch offline (no cache) | ErrorState shown with "Couldn't load" (no infinite skeleton). |
| 27 | App crashes → restart | Zustand stores preserved. Offline queue intact. |

### Phase 4 — Tests + CI

| # | Test | Expected |
|---|------|----------|
| 28 | `isNetworkError` unit tests | 6/6 pass. |
| 29 | `offlineStore` unit tests | enqueue, remove, getPendingOperations, hydrate all pass. |
| 30 | `syncEngine` unit tests | push, pull, conflict, skip-if-syncing all pass. |
| 31 | `persistQueryClient` test | Cache restored from AsyncStorage. |
| 32 | All 11 mutation hooks integration tests | Online path, offline path, 4xx path all pass. |
| 33 | E2E: offline journal → online sync | Passes (uses `E2E_TEST_OFFLINE` launch arg). |
| 34 | E2E: load calendar → force-quit → offline relaunch | Calendar loads from cache. |
| 35 | CI: `tsc --noEmit` | No TypeScript errors. |
| 36 | CI: `jest --coverage` | Global >=80% lines, queries >=95% lines. |

### Phase 5 — Monitoring

| # | Test | Expected |
|---|------|----------|
| 37 | Trigger offline write | Console: `offlineStore.enqueued` with type, id, queue size. |
| 38 | Sync cycle runs | Console: `sync.cycle.starting` → `sync.cycle.completed` with duration. |
| 39 | Sync fails | Console: `sync.cycle.failed` with error and queue size. |
| 40 | Sentry breadcrumbs visible | "Operation queued: journal/create" — no PII in data fields. |
| 41 | Sentry sync failure event | `extra.pending_ops` has `id`, `type`, `priority`, `retryCount` only — no data. |
| 42 | Open OfflineDashboard | Shows queue, metrics, network status. |
| 43 | Tap "Force Sync" in dashboard | `syncAll()` triggers. Toast: "Syncing..." → "Sync completed". |
| 44 | Force-quit → relaunch | Metrics persist (from AsyncStorage). |

---

## 9. Deploy Gates

### Phase 1 Gate

```bash
cd mobile
npx tsc --noEmit
npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
npx eslint src/services/queries/ src/app/providers.tsx
# Manual: tests 1-8 from §8 Phase 1
```

### Phase 2 Gate

```bash
cd mobile
npx tsc --noEmit
npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
npx eslint src/screens/safety/SOSActiveScreen.tsx src/screens/cycle/
# Manual: tests 11-22 from §8 Phase 2
```

### Phase 3 Gate

```bash
cd mobile
npx tsc --noEmit
npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
# Manual: tests 23-27 from §8 Phase 3
```

### Phase 4 Gate

```bash
cd mobile
npx tsc --noEmit
npx eslint src/
npx jest --coverage --coverageThreshold='{"global":{"lines":80,"functions":80,"branches":75},"./src/services/queries/":{"lines":95,"functions":95}}'
npx detox test e2e/offline.test.ts --configuration ios.sim.debug
```

### Phase 5 Gate

```bash
cd mobile
npx tsc --noEmit
npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
npx eslint src/services/sync/ src/stores/
# Manual: tests 37-44 from §8 Phase 5
```

---

## 10. Rollback Plan

| Phase | Revert Command | Impact |
|-------|---------------|--------|
| 1 | `git revert <phase1-commit>` — reverts `queries/*.ts`, `providers.tsx` | App falls to online-only writes, in-memory cache. Queue data in EncryptedStorage remains safe. |
| 2 | `git revert <phase2-commit>` — reverts SOS, LogPeriod, model updater | SOS fails offline again. Period log loses data again. |
| 3 | `git revert <phase3-commit>` — reverts banner, hook, ErrorBoundary | Banner shows generic message. Error boundary may wrap providers. |
| 4 | `git revert <phase4-commit>` — reverts test files + CI config | Loses CI gate — must revert with caution. |
| 5 | `git revert <phase5-commit>` — reverts sync logging, breadcrumbs, dashboard | Loses observability. No production impact. |

No data loss risk from any phase rollback: offline queue and SOS queue use EncryptedStorage, never cleared by code changes.

architecture_phase0_overview_dataflow.md
architecture_phase1_offline_write_queue_persistence.md
architecture_phase2_sos_cycle_period.md
architecture_phase3_ui_polish_network_ux.md
architecture_phase4_validation_testing_deploy.md
architecture_phase5_monitoring_observability.md