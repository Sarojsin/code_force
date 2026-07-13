# Architecture Phase 5: Monitoring, Observability & Post-Launch

**Priority:** Medium (2 days)
**Dependencies:** Phases 1-4 complete
**Files touched:** 6 (1 logging utility, 1 App entry, 1 sync engine, 1 queries wrapper, 1 ML hydration, 1 config)

---

## 1. Objective

Make the offline-first architecture observable in production. When something goes wrong (queue stuck, sync failure, cache corruption), the team must know within minutes, not days. This phase adds structured logging, Sentry breadcrumbs, health metrics, and a dashboard for sync health.

| Sub-task | Effort | Success Metric |
|----------|--------|----------------|
| 5a. Structured logging for sync lifecycle | 0.5 day | Every sync cycle logged with duration, ops pushed, ops pulled |
| 5b. Sentry breadcrumbs for offline events | 0.5 day | Every offline write, queue drain, sync failure tagged in Sentry |
| 5c. Sync health metrics | 0.5 day | Queue size, sync latency, failure rate exposed for monitoring |
| 5d. Offline dashboard (dev-only) | 0.5 day | Dev screen showing queue state, pending ops, last sync |

---

## 2. Current State (Before)

Logging is inconsistent:
- `syncEngine.ts` has basic `logger.info('sync.starting')` and `logger.warn('sync.pull_failed')`
- `offlineStore.ts` has `logger.error('offlineStore.persist_failed')` and `logger.error('offlineStore.hydrate_failed')`
- No structured fields (no `duration`, `opsCount`, `queueSize` in log lines)
- No Sentry breadcrumbs for offline events
- No metrics endpoint to check sync health
- No developer tool to inspect queue state

---

## 3. Phase 5a: Structured Logging for Sync Lifecycle

### 3.1 Log Format

Every sync-related log line follows this structure:

```typescript
logger.info('sync.cycle', {
  event: 'sync_cycle_started',
  duration_ms: 0,            // Will be updated on completion
  ops_pushed: 0,
  ops_pulled: 0,
  queue_size_before: 0,
  queue_size_after: 0,
  is_syncing: false,
});
```

### 3.2 Sync Engine Logging

**File:** `src/services/sync/syncEngine.ts`

```typescript
export async function syncAll(): Promise<void> {
  if (_isSyncing) {
    logger.warn('sync.cycle.skipped_already_syncing');
    return;
  }

  const user = useAuthStore.getState().user;
  if (!user) {
    logger.warn('sync.cycle.skipped_no_auth');
    return;
  }

  _isSyncing = true;
  const startTime = Date.now();
  const store = useOfflineStore.getState();
  const queueSizeBefore = store.operations.length;

  logger.info('sync.cycle.starting', {
    event: 'sync_cycle_started',
    queue_size: queueSizeBefore,
    user_id: user.id,
  });

  try {
    const pending = store.getPendingOperations();
    const pendingToPush = getRetryableOps(pending);
    let opsPushed = 0;
    let opsPulled = 0;

    if (pendingToPush.length > 0) {
      logger.info('sync.push.starting', {
        event: 'sync_push_started',
        op_count: pendingToPush.length,
      });
      await pushOperations(pendingToPush);
      opsPushed = pendingToPush.length;
      logger.info('sync.push.completed', {
        event: 'sync_push_completed',
        op_count: opsPushed,
        duration_ms: Date.now() - startTime,
      });
    }

    const latestTimestamp = await pullServerData();
    if (latestTimestamp) {
      // 🟡 Refinement: pullServerData returns timestamp only. If it is ever refactored to return
      // { items: [...], timestamp: ... }, use items.length. Otherwise, track as boolean success.
      opsPulled = 1;
    }

    const queueSizeAfter = store.operations.length;
    const duration = Date.now() - startTime;

    logger.info('sync.cycle.completed', {
      event: 'sync_cycle_completed',
      duration_ms: duration,
      ops_pushed: opsPushed,
      ops_pulled: opsPulled,
      queue_size_before: queueSizeBefore,
      queue_size_after: queueSizeAfter,
      user_id: user.id,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('sync.cycle.failed', {
      event: 'sync_cycle_failed',
      duration_ms: duration,
      queue_size_before: queueSizeBefore,
      error: error instanceof Error ? error.message : String(error),
      user_id: user.id,
    });
  } finally {
    _isSyncing = false;
  }
}
```

### 3.3 Offline Store Logging

**File:** `src/stores/offlineStore.ts`

Add logging to key store methods:

```typescript
enqueue: async (op) => {
  const id = generateId();
  const newOp: PendingOperation = { ...op, id, createdAt: new Date().toISOString(), retryCount: 0, maxRetries: 5 };
  const ops = [...get().operations, newOp];
  set({ operations: ops });
  await persist(ops);
  logger.info('offlineStore.enqueued', {
    event: 'offline_op_enqueued',
    operation_id: id,
    type: op.type,
    priority: op.priority,
    queue_size: ops.length,
  });
  return id;
},

discard: async (id) => {
  const op = get().operations.find(o => o.id === id);
  const ops = get().operations.filter(o => o.id !== id);
  set({ operations: ops });
  await persist(ops);
  logger.warn('offlineStore.discarded', {
    event: 'offline_op_discarded',
    operation_id: id,
    type: op?.type,
    retry_count: op?.retryCount,
    max_retries: op?.maxRetries,
  });
},
```

---

## 4. Phase 5b: Sentry Breadcrumbs

### 4.1 Sentry Setup

**File:** `src/services/sync/sentrySyncBreadcrumbs.ts`

```typescript
import * as Sentry from '@sentry/react-native';
import { useOfflineStore } from 'src/stores/offlineStore';

export function initSyncBreadcrumbs() {
  // Subscribe to offline store changes
  useOfflineStore.subscribe((state, prevState) => {
    // Log when operations are added
    if (state.operations.length > prevState.operations.length) {
      Sentry.addBreadcrumb({
        category: 'offline',
        message: `Operation queued: ${state.operations[state.operations.length - 1]?.type}`,
        level: 'info',
        data: {
          queueSize: state.operations.length,
        },
      });
    }

    // Log when operations are removed (successful sync)
    if (state.operations.length < prevState.operations.length) {
      const count = prevState.operations.length - state.operations.length;
      Sentry.addBreadcrumb({
        category: 'offline',
        message: `${count} operation(s) synced successfully`,
        level: 'info',
        data: {
          queueSizeBefore: prevState.operations.length,
          queueSizeAfter: state.operations.length,
        },
      });
    }
  });
}
```

### 4.2 Sentry Tags on Critical Operations

**File:** `src/services/sync/syncEngine.ts` — add Sentry scope tagging:

```typescript
import * as Sentry from '@sentry/react-native';

export async function syncAll(): Promise<void> {
  Sentry.setTag('sync.is_syncing', 'true');

  // ... existing sync logic ...

  if (error) {
    Sentry.captureException(error, {
      tags: {
        sync_phase: 'push' | 'pull',
        queue_size: String(queueSizeBefore),
      },
      extra: {
        // 🔴 NEVER include o.data here — may contain PII (journal content, symptoms, etc.)
        pending_ops: pendingToPush.map(o => ({
          id: o.id,
          type: o.type,
          priority: o.priority,
          retryCount: o.retryCount,
        })),
      },
    });
  }

  Sentry.setTag('sync.is_syncing', 'false');
}
```

### 4.3 Sentry Breadcrumbs for Mutation Hooks

**File:** `src/services/queries/offlineMutationWrapper.ts`

Create a wrapper that adds Sentry breadcrumbs to every offline mutation.

**🔴 Critical — PII Sanitization Required:** Sending raw user content (journal text, symptoms, period data) to Sentry violates the app's privacy-first promise and is a GDPR/HIPAA risk. All sensitive fields must be explicitly redacted before reaching Sentry.

```typescript
import * as Sentry from '@sentry/react-native';

// 🔴 Fields that must NEVER be sent to Sentry (contain PII)
const SENSITIVE_FIELDS = new Set([
  'content',       // journal content
  'notes',         // user notes
  'symptoms',      // health data
  'mood_tags',
  'flow_intensity',
  'body',          // catch-all for API request bodies
  'data',          // generic wrapper
]);

function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function addOfflineBreadcrumb(type: string, data: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category: 'offline.mutation',
    message: `Offline ${type} queued`,
    level: 'info',
    data: {
      type,
      ...sanitizeData(data),  // ✅ Always sanitize before sending
    },
  });
}

// Called from mutation onError handlers:
// addOfflineBreadcrumb('journal/create', { tempId, clientUpdatedAt });
```

---

## 5. Phase 5c: Sync Health Metrics

### 5.1 Metrics Store

**File:** `src/stores/syncMetricsStore.ts`

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

interface SyncMetricsState extends SyncMetrics {
  recordSync: (status: 'success' | 'failed', duration: number, opsPushed: number, opsPulled: number, queueSize: number) => void;
  reset: () => void;
}

const initial: SyncMetrics = {
  lastSyncAt: null,
  lastSyncDuration: null,
  lastSyncStatus: null,
  totalOpsPushed: 0,
  totalOpsPulled: 0,
  totalSyncCycles: 0,
  failedSyncCycles: 0,
  maxQueueSize: 0,
};

export const useSyncMetricsStore = create<SyncMetricsState>()(
  persist(
    (set, get) => ({
      ...initial,
      recordSync: (status, duration, opsPushed, opsPulled, queueSize) => {
        const state = get();
        set({
          lastSyncAt: new Date().toISOString(),
          lastSyncDuration: duration,
          lastSyncStatus: status,
          totalOpsPushed: state.totalOpsPushed + opsPushed,
          totalOpsPulled: state.totalOpsPulled + opsPulled,
          totalSyncCycles: state.totalSyncCycles + 1,
          failedSyncCycles: state.failedSyncCycles + (status === 'failed' ? 1 : 0),
          maxQueueSize: Math.max(state.maxQueueSize, queueSize),
        });
      },
      reset: () => set(initial),
    }),
    {
      name: 'shecare.sync.metrics',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

### 5.2 Log Sync Metrics from Sync Engine

**File:** `src/services/sync/syncEngine.ts` — call `recordSync()` at end of `syncAll()`:

```typescript
import { useSyncMetricsStore } from 'src/stores/syncMetricsStore';

// At the end of syncAll():
const metrics = useSyncMetricsStore.getState();
metrics.recordSync(
  error ? 'failed' : 'success',
  Date.now() - startTime,
  opsPushed,
  opsPulled,
  store.operations.length,
);
```

### 5.3 Sync Health Check Endpoint (Backend)

The Android/iOS app can report sync health metrics to a backend endpoint for centralized monitoring:

**File:** Not yet implemented — future enhancement

```
POST /api/v1/sync/health
{
  "last_sync_at": "2025-01-15T10:30:00Z",
  "last_sync_duration_ms": 1234,
  "last_sync_status": "success",
  "total_ops_pushed": 42,
  "total_ops_pulled": 156,
  "total_sync_cycles": 89,
  "failed_sync_cycles": 3,
  "max_queue_size": 12,
  "current_queue_size": 0,
  "app_version": "1.2.3",
  "platform": "ios"
}
```

---

## 6. Phase 5d: Offline Developer Dashboard

### 6.1 Dev-Only Screen

**File:** `src/screens/dev/OfflineDashboardScreen.tsx`

```typescript
import React, { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useOfflineStore } from 'src/stores/offlineStore';
import { useSyncMetricsStore } from 'src/stores/syncMetricsStore';
import { useNetworkStatus } from 'src/services/sync';
import { syncAll } from 'src/services/sync/syncEngine';
import { Card, Text, Button } from 'src/components/ui';
import { useTheme } from 'src/theme';

export function OfflineDashboardScreen() {
  const { isConnected, connectionType } = useNetworkStatus();
  const operations = useOfflineStore((s) => s.operations);
  const metrics = useSyncMetricsStore();
  const theme = useTheme();

  const handleForceSync = useCallback(async () => {
    Toast.show({ type: 'info', text1: 'Syncing...' });
    try {
      await syncAll();
      Toast.show({ type: 'success', text1: 'Sync completed' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Sync failed', text2: e?.message });
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text variant="h1">Sync Dashboard</Text>

        {/* Network status */}
        <Card style={{ marginTop: 16 }}>
          <Text variant="h3">Network</Text>
          <Text>Connected: {isConnected ? 'Yes' : 'No'}</Text>
          <Text>Type: {connectionType || 'N/A'}</Text>
        </Card>

        {/* Queue state */}
        <Card style={{ marginTop: 12 }}>
          <Text variant="h3">Queue</Text>
          <Text>Pending operations: {operations.length}</Text>
          {operations.map((op) => (
            <View key={op.id} style={{ marginTop: 8, padding: 8, backgroundColor: theme.colors.surface, borderRadius: 8 }}>
              <Text variant="bodySmall">Type: {op.type}</Text>
              <Text variant="bodySmall">Priority: {op.priority}</Text>
              <Text variant="bodySmall">Retries: {op.retryCount}/{op.maxRetries}</Text>
              <Text variant="bodySmall">Created: {new Date(op.createdAt).toLocaleString()}</Text>
            </View>
          ))}
        </Card>

        {/* Sync metrics */}
        <Card style={{ marginTop: 12 }}>
          <Text variant="h3">Metrics</Text>
          <Text>Last sync: {metrics.lastSyncAt ? new Date(metrics.lastSyncAt).toLocaleString() : 'Never'}</Text>
          <Text>Last status: {metrics.lastSyncStatus || 'N/A'}</Text>
          <Text>Last duration: {metrics.lastSyncDuration ? `${metrics.lastSyncDuration}ms` : 'N/A'}</Text>
          <Text>Total cycles: {metrics.totalSyncCycles}</Text>
          <Text>Failed: {metrics.failedSyncCycles}</Text>
          <Text>Ops pushed: {metrics.totalOpsPushed}</Text>
          <Text>Max queue: {metrics.maxQueueSize}</Text>
        </Card>

        {/* Actions */}
        <View style={{ marginTop: 16, gap: 8 }}>
          <Button label="Force Sync" onPress={handleForceSync} variant="primary" />
          <Button label="Clear Queue" onPress={() => useOfflineStore.getState().clear()} variant="outline" />
          <Button label="Reset Metrics" onPress={() => useSyncMetricsStore.getState().reset()} variant="outline" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

### 6.2 Access

Conditional compilation: only include this screen in `DEBUG` builds.

**🟡 Refinement — Safe Dynamic Import:** Use `require()` inside the `__DEV__` block to prevent the screen from being bundled in production builds. Tree-shaking may not remove static imports.

```typescript
// src/navigation/index.tsx
if (__DEV__) {
  // ✅ require() inside __DEV__ block prevents production bundling
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const OfflineDashboardScreen = require('../screens/dev/OfflineDashboardScreen').default;
  mainStack.Screen name="OfflineDashboard" component={OfflineDashboardScreen} options={{ title: 'Sync Dashboard' }};
}
```

---

## 7. Integration Points

```
Phase 5 additions:
  ├── syncEngine.ts → structured logging + Sentry tags + metrics recording
  ├── offlineStore.ts → per-operation logging + Sentry breadcrumbs
  ├── queries/*.ts → Sentry breadcrumbs on offline enqueue (via wrapper)
  ├── stores/syncMetricsStore.ts → persisted metrics (new)
  └── screens/dev/OfflineDashboardScreen.tsx → dev UI (new)
```

---

## 8. Validation

| # | Test | Expected |
|---|------|----------|
| 1 | Trigger offline write | Console shows `offlineStore.enqueued` with type, id, queue size |
| 2 | Sync cycle runs | Console shows `sync.cycle.starting` → `sync.cycle.completed` with duration |
| 3 | Sync fails | Console shows `sync.cycle.failed` with error and queue size |
| 4 | Open Sentry dashboard | Breadcrumbs visible: "Operation queued: journal/create" |
| 5 | Open Sentry issue | Tagged with `sync_phase`, `queue_size` |
| 6 | Open OfflineDashboard (dev) | Shows queue, metrics, network status |
| 7 | Force-quit, relaunch | Metrics persist (from AsyncStorage) |
| 8 | Tap "Force Sync" in OfflineDashboard | `syncAll()` triggers. Toast shows "Syncing..." then "Sync completed" or "Sync failed" |
| 9 | Check Sentry breadcrumb for offline write | No sensitive text (journal content, symptoms) appears in breadcrumb `data`. Only metadata (type, id, timestamp) |
| 10 | Check Sentry error event for sync failure | `extra.pending_ops` contains only `id`, `type`, `priority`, `retryCount`. NO `data` fields with user content |

---

## 9. Deploy Gate

```bash
cd mobile
npx tsc --noEmit
npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
npx eslint src/services/sync/ src/stores/
```

No change to app behavior for end users — purely observability. Low risk.
