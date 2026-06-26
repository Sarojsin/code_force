# Phase 5: Hybrid Offline/Online Sync Strategy

## Objective

The app is fully functional offline. All writes (journal, cycle logs, mood logs) queue locally and sync when connectivity resumes. The server handles conflict resolution via **last-write-wins with client-side timestamp authority** (the `client_updated_at` generated when the user performed the action, NOT the server arrival time).

## Data Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│    Mobile App       │         │   Backend Server    │
│                     │   sync  │                     │
│  ┌───────────────┐  │ ◄───────►  ┌───────────────┐ │
│  │ EncryptedStore │  │         │  │  PostgreSQL   │ │
│  │ (AsyncStorage) │  │  push   │  │  (source of   │ │
│  │  - Auth tokens │  │ ◄───────►  │   truth)      │ │
│  │  - Journal raw │  │  pull   │  └───────────────┘ │
│  │  - Drafts      │  │  ───────► │   ETags         │ │
│  │  - Pending ops │  │  reval   │   Cursor pagination│
│  └───────────────┘  │         └─────────────────────┘
│                     │
│  ┌───────────────┐  │
│  │ React Query   │  │  stale-while-revalidate
│  │ Cache (RAM)   │  │  + background refetch
│  └───────────────┘  │
└─────────────────────┘
```

## Offline Queue: `src/stores/offlineStore.ts`

### Zustand Store

```typescript
interface PendingOperation {
  id: string;             // UUID (generated on device) — also sent as Idempotency-Key header
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;       // e.g. '/api/v1/cycle/entries'
  body: any;              // Payload
  temp_id?: string;       // Client-generated temp ID for dependency cascading
  client_updated_at: string; // ISO timestamp from device (the user's action time)
  createdAt: string;      // ISO timestamp (queue entry time)
  retryCount: number;
  maxRetries: number;     // 5
}

interface OfflineState {
  pendingOps: PendingOperation[];
  isSyncing: boolean;
  lastSyncAt: string | null;
  addOperation: (op: Omit<PendingOperation, 'id' | 'createdAt' | 'retryCount'>) => void;
  removeOperation: (id: string) => void;
  incrementRetry: (id: string) => void;
  setSyncing: (v: boolean) => void;
  setLastSync: (v: string) => void;
}
```

### Persistence

Store is backed by `encrypted-storage` (not plain AsyncStorage) because pending operations may contain analysis data. On app start, `offlineStore.hydrate()` restores the queue from encrypted storage.

## Sync Engine: `src/services/sync/syncEngine.ts`

### Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ App launches → hydrate stores                                │
│ NetInfo.subscribe → onConnectivityChange:                     │
│   offline → show banner, queue writes                        │
│   online  → trigger syncCycle()                              │
│ Background → if online every 5 min, trigger partial sync     │
│ Focus → trigger syncCycle()                                  │
└─────────────────────────────────────────────────────────────┘
```

### `syncEngine.ts`

```typescript
class SyncEngine {
  private isSyncing = false;

  async syncCycle(): Promise<SyncResult> {
    if (this.isSyncing) return { status: 'already_syncing' };
    this.isSyncing = true;
    try {
      // Phase 1: Push pending operations (FIFO)
      await this.pushPendingOps();

      // Phase 2: Pull server data (fetch via ETag revalidation)
      await this.pullServerData();

      // Phase 3: Sync global model coefficients
      await this.syncModelCoefficients();

      this.isSyncing = false;
      return { status: 'completed', opsPushed: ..., opsPulled: ... };
    } catch (e) {
      this.isSyncing = false;
      return { status: 'failed', error: e };
    }
  }

  private async pushPendingOps(): Promise<void> {
    const ops = offlineStore.getState().pendingOps
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const op of ops) {
      try {
        await this.executeOp(op);
        offlineStore.getState().removeOperation(op.id);
      } catch (e) {
        if (isRetryableError(e)) {
          offlineStore.getState().incrementRetry(op.id);
          if (op.retryCount >= op.maxRetries) {
            this.removeCascading(op);
          }
          throw e; // Stop the batch; next cycle retries
        } else {
          // Non-retryable: discard and remove dependent ops
          this.removeCascading(op);
        }
      }
    }
  }

  // Critical: when a CREATE fails permanently, remove all dependent
  // UPDATE/DELETE ops that reference the same temp_id.
  // Prevents orphaned updates (PUT /journal/{tempId}) from 404-ing forever.
  private removeCascading(failedOp: PendingOperation): void {
    offlineStore.getState().removeOperation(failedOp.id);
    const tempId = failedOp.body?.temp_id || failedOp.body?.id;
    if (!tempId) return;
    const dependents = offlineStore.getState().pendingOps
      .filter(o => o.body?.temp_id === tempId || o.body?.id === tempId);
    dependents.forEach(dep => offlineStore.getState().removeOperation(dep.id));
  }

  private async executeOp(op: PendingOperation): Promise<void> {
    const headers: Record<string, string> = {
      'Idempotency-Key': op.id,
    };
    if (op.client_updated_at) {
      headers['X-Client-Updated-At'] = op.client_updated_at;
    }
    const config = { headers };
    switch (op.type) {
      case 'CREATE':
        await apiClient.post(op.endpoint, op.body, config);
        break;
      case 'UPDATE':
        await apiClient.put(op.endpoint, op.body, config);
        break;
      case 'DELETE':
        await apiClient.delete(op.endpoint, config);
        break;
    }
  }

  private async pullServerData(): Promise<void> {
    // Fetch with ETag revalidation
    // 1. Cycle entries (since last sync)
    // 2. Predictions
    // 3. Emergency contacts / SOS status
    // 4. Safety info
  }

  private async syncModelCoefficients(): Promise<void> {
    // Check if global model version changed
    // If yes, download new coefficients
  }
}

// Helpers
function isRetryableError(e: any): boolean {
  // 429, 5xx → retryable
  // 400, 401, 403, 404 → not retryable
  const status = e?.response?.status;
  return status === 429 || (status >= 500 && status < 600);
}
```

## Backend: ETag Support

### `app/core/dependencies.py`

```python
async def compute_etag(data: list | dict) -> str:
    """Compute ETag from data hash."""
    raw = json.dumps(data, sort_keys=True, default=str)
    return hashlib.md5(raw.encode()).hexdigest()
```

### `app/core/responses.py`

```python
from fastapi.responses import Response as FastAPIResponse

class ETagResponse(FastAPIResponse):
    """Response that sets ETag and handles If-None-Match."""
    def __init__(self, content: Any, *args, **kwargs):
        data = orjson.dumps(content)
        etag = hashlib.md5(data).hexdigest()
        super().__init__(
            content=data,
            media_type="application/json",
            headers={"ETag": etag, **kwargs.pop("headers", {})},
            *args, **kwargs
        )
```

### Usage in Calendar Route

```python
@router.get("/calendar")
async def get_calendar(...):
    # If request has If-None-Match header:
    #   compute ETag for current data
    #   if match → 304 Not Modified (no body)
    # Else → 200 with ETag header
```

### Backend Route Sync Helpers

```
GET /api/v1/sync/changes?since=<ISO timestamp>
  Response: {
    "cycle_entries": [...new/updated since timestamp],
    "predictions": [...],
    "deleted_ids": [...IDs deleted since timestamp],
    "timestamp": <server ISO timestamp>
  }

POST /api/v1/sync/batch
  Body: { "operations": [{ "id", "type", "endpoint", "body", "client_updated_at" }] }
  Response: { "results": [{ "status": "created"|"updated"|"conflict"|"error", "server_id", "server_data" }] }
```

### Conflict Resolution (Backend)

```python
# For each operation in POST /sync/batch (UPSERT):
async def handle_upsert(record_id, client_updated_at, payload, idempotency_key):
    # 1. Idempotency check (24h window)
    existing = await find_by_idempotency_key(idempotency_key)
    if existing:
        return {"status": "created", "server_id": str(existing.id)}

    # 2. Update existing record
    record = await db.get(record_id)
    if not record:
        # Client timestamp drift protection: clamp future timestamps
        if client_updated_at > now + timedelta(minutes=5):
            client_updated_at = now
        record = Model(**payload, updated_at=client_updated_at)
        db.add(record)
    else:
        # Compare client_updated_at with server record.updated_at
        if record.updated_at > client_updated_at:
            # Server has newer data → CONFLICT
            return {"status": "conflict", "server_data": record.to_dict()}
        elif record.updated_at < client_updated_at:
            # Client has newer data → UPDATE
            record.updated_at = client_updated_at
            for k, v in payload.items():
                setattr(record, k, v)
        # else: identical → skip (no-op)

    await db.commit()
    return {"status": "updated", "server_id": str(record.id)}
```

### Mobile Conflict Handling

```typescript
// In syncEngine.ts after receiving a conflict response:
if (result.status === 'conflict') {
  // Write server's version to local store (overwriting draft)
  encryptedStorage.setItem(`cache_${result.server_id}`, result.server_data);
  // Invalidate React Query cache so next render shows server data
  queryClient.invalidateQueries({ queryKey: [endpoint] });
  // UI feedback
  Toast.show({
    type: 'info',
    text1: 'Conflict resolved',
    text2: 'The server had a newer version of this entry.',
  });
}
```

## Offline Banner

```typescript
// In App.tsx or a global wrapper
function ConnectivityBanner() {
  const { isConnected } = useNetworkStatus();
  if (isConnected) return null;
  return (
    <Banner type="warning">
      You're offline. Your data will sync when you're back online.
    </Banner>
  );
}
```

## Draft Auto-Save (Journal)

```typescript
// In JournalScreen.tsx
const DRAFT_SAVE_INTERVAL_MS = 30_000;  // 30 seconds

useEffect(() => {
  const interval = setInterval(async () => {
    if (journalContent.trim()) {
      await encryptedStorage.setItem('journal_draft', {
        content: journalContent,
        savedAt: new Date().toISOString(),
      });
      Toast.show({ type: 'success', text1: 'Draft saved' });
    }
  }, DRAFT_SAVE_INTERVAL_MS);
  return () => clearInterval(interval);
}, [journalContent]);

// On screen mount
useEffect(() => {
  const draft = await encryptedStorage.getItem('journal_draft');
  if (draft) {
    setJournalContent(draft.content);
    // Convert savedAt to relative text, show "Draft from 5 min ago"
  }
}, []);
```

## Clarification: `client_updated_at` Consistency (Non-Blocking)

**The Inconsistency:** In `executeOp()`, `client_updated_at` is sent as an HTTP header (`X-Client-Updated-At`). But in `POST /sync/batch`, the body contains the operation with `client_updated_at` inside it. If the server reads the header but not the body (or vice versa), LWW will silently fail.

**Fix (Recommended):** Prefer the request body as the single source for `client_updated_at`.

- For **batch mode** (`POST /sync/batch`): rely solely on `operations[].client_updated_at` in the body — do NOT read the header.
- For **standalone endpoints** (`POST /api/v1/cycle/entries`): keep the header for simplicity, but also accept `client_updated_at` in the body if present (body wins).

**Action item for implementation ticket:** "Ensure `client_updated_at` is sent consistently. Prefer body for batch operations."

## Minor Refinements (Non-Blocking)

| Area | Suggestion |
|------|------------|
| **Idempotency on Batch** | `PendingOperation.id` (UUID) sent as `Idempotency-Key` header. Server ignores duplicates within 24h to prevent retry duplicates. |
| **React Query Invalidation** | After `pullServerData()` completes, invalidate all relevant React Query caches (`useCycleEntries`, `useJournalEntries`). Otherwise UI won't reflect newly synced data. |
| **Battery Optimization (Background)** | iOS background fetch is unpredictable. Use `react-native-background-fetch` with minimum 15-min interval instead of 5 min. |
| **Large Payloads** | If a user has 100+ pending operations, `POST /sync/batch` could be huge. Compress request body with gzip (supported by Axios/fetch). |
| **Local Timestamp Drift** | If user's phone clock is 10 min ahead, `client_updated_at` could be in the future. Server clamps to `NOW()` if `client_updated_at > NOW() + 5 min` to prevent sort-order corruption. |

## Validation Criteria

### Core

- [ ] Operation queued when offline: stored to encrypted storage
- [ ] Operation queued when offline: visible in offline store state
- [ ] Sync cycle: pushes pending operations FIFO
- [ ] Sync cycle: stops on first non-retryable error, continues on retryable
- [ ] Sync cycle: retryable ops retried up to 5 times then discarded
- [ ] Sync cycle: non-retryable ops (400, 401, 404) discarded immediately
- [ ] Sync cycle: pulls new cycle entries + predictions from server
- [ ] ETag: calendar endpoint returns ETag header
- [ ] ETag: same data + If-None-Match returns 304
- [ ] Offline banner: shown when network lost, hidden on reconnect
- [ ] Journal draft: auto-saved every 30s
- [ ] Journal draft: restored on screen mount
- [ ] TypeScript: `npx tsc --noEmit` passes with 0 errors

### Critical Gaps (Must Fix)

- [ ] **Dependency Cascading:** If a CREATE operation fails permanently, all dependent UPDATE/DELETE operations for that `temp_id` are also discarded via `removeCascading()`.
- [ ] **Conflict Resolution (Client Timestamp):** If server has a newer `updated_at` than the client's `client_updated_at`, server returns `"status": "conflict"` with `server_data`. Mobile writes server version locally and shows toast.
- [ ] **Client Timestamp on All Models:** All write models include a `client_updated_at` field sent by the mobile client.
- [ ] **Idempotency in Batch:** Duplicate `Idempotency-Key` within 24h returns existing response (no duplicate processing).
- [ ] **React Query Invalidation:** After successful `pullServerData()`, invalidate all relevant React Query caches so UI reflects synced state.
- [ ] **Battery-Friendly Background Sync:** Use 15-min minimum interval via `react-native-background-fetch` (not 5-min).
- [ ] **Timestamp Drift Protection:** Server clamps `client_updated_at` to `NOW()` if > 5 min in the future.
- [ ] **Large Payload Gzip:** Compress large `/sync/batch` payloads with gzip.
