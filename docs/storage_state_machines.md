# Storage State Machines

> Entity lifecycle states and transitions for the SheCare offline storage architecture.
> Applies to both Phase 1 (EncryptedStorage queue) and Phase 2 (SQLite cache).

---

## 1. Offline Queue Item (PendingOperation)

The offline queue item is the unit of work for the sync engine. It tracks a single user action that needs to be sent to the server.

### States

```
                  ┌──────────┐
                  │  PENDING │
                  └────┬─────┘
                       │ sync engine picks up
                       v
                  ┌──────────┐
           ┌──────│ SYNCING  │──────┐
           │      └──────────┘      │
           │                       │
     server 200              server 4xx/5xx
           │                       │
           v                       v
    ┌───────────┐          ┌──────────┐
    │ COMPLETED │          │  FAILED  │
    └───────────┘          └─────┬────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              retry < max                retry >= max
                    │                         │
                    v                         v
             ┌──────────┐             ┌───────────┐
             │ PENDING  │             │ DISCARDED │
             └──────────┘             └───────────┘
```

| Transition | Trigger | Description |
|------------|---------|-------------|
| `PENDING → SYNCING` | Sync engine picks up the item | `offlineStore.markSyncing(op.id)` |
| `SYNCING → COMPLETED` | Server returns 200/201 | `offlineStore.remove(op.id)` — upsert SQLite + invalidate RQ |
| `SYNCING → COMPLETED` | Server returns 409 (conflict) | `offlineStore.discard(op.id)` — overwrite SQLite with server data |
| `SYNCING → FAILED` | Server returns 4xx/5xx (non-retryable) | `offlineStore.markFailed(op.id)`, increment retry count |
| `FAILED → PENDING` | Retry timer fires | `offlineStore.resetRetries(op.id)` — returned to queue |
| `FAILED → DISCARDED` | Max retries exceeded (maxRetries = 5) | `offlineStore.discard(op.id)` — Sentry logged, toast shown |

### Fields Tracked

| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID, generated client-side |
| type | string | e.g. `cycle/create`, `journal/create`, `safety/sos/trigger` |
| endpoint | string | API path (e.g. `/api/v1/cycle/entries`) |
| payload | Record<string, unknown> | Request body |
| idempotencyKey | string | UUID, prevents duplicate processing |
| clientUpdatedAt | string | ISO datetime of original action |
| createdAt | string | ISO datetime of enqueue |
| retryCount | number | 0..maxRetries |
| maxRetries | number | 5 for normal, 5 for SOS |
| priority | 'high' \| 'normal' | SOS operations get 'high' |
| status | PendingOperationStatus | current state |

---

## 2. Sync Engine Run

The sync engine processes the queue. Each run has a lifecycle.

### States

```
    ┌──────────┐
    │  IDLE    │
    └────┬─────┘
         │ NetInfo fires isConnected = true
         v
   ┌───────────┐
   │ SYNCING   │
   └─────┬─────┘
         │
    ┌────┴────┐
    │         │
    v         v
┌────────┐ ┌────────┐
│ PUSH   │ │ PULL   │
│ PHASE  │ │ PHASE  │
└───┬────┘ └───┬────┘
    │          │
    └────┬─────┘
         │ both complete
         v
   ┌──────────┐
   │ COMPLETED│
   └──────────┘
```

**Phases (always push first, then pull):**

1. **Push phase:** Iterate through FIFO queue, send each via `POST /sync/batch` (gzip if >10 items). Max 5 retries per item.
2. **Pull phase:** `GET /sync/changes?since={lastPullTimestamp}`. Process paginated results.

---

## 3. Cycle Entry (SQLite Record)

The lifecycle of a cycle entry as stored in SQLite.

### States

```
                  ┌──────────┐
                  │  ACTIVE  │
                  └────┬─────┘
                       │
              ┌────────┴────────┐
              │                 │
        user deletes       user corrects
              │                 │
              v                 v
        ┌──────────┐    ┌──────────────┐
        │ SOFT-    │    │  CORRECTED   │
        │ DELETED  │    │  (replaced)  │
        └──────────┘    └──────┬───────┘
              │                 │
              │                 │ server confirms
              │                 v
              │           ┌──────────┐
              │           │  ACTIVE  │ (new entry with correction flag)
              │           └──────────┘
              │
              │ cleanup (pruning, >90d)
              v
        ┌──────────┐
        │ HARD-    │
        │ DELETED  │
        └──────────┘
```

| Transition | Trigger | Description |
|------------|---------|-------------|
| `ACTIVE → SOFT-DELETED` | User deletes entry | `is_active = false`, `deleted_at = now()` |
| `ACTIVE → CORRECTED` | User submits correction | New entry created with `is_correction = true` |
| `CORRECTED → ACTIVE` | Server confirms correction | New correction entry becomes active, old may get flagged |
| `SOFT-DELETED → HARD-DELETED` | Pruning run (>90d old) | Record physically removed from SQLite |

---

## 4. Journal Entry (SQLite Record)

### States

```
    ┌──────────┐
    │  ACTIVE  │──── user edits ────► UPDATED (same record, updated_at bumped)
    └────┬─────┘
         │ user deletes
         v
    ┌──────────┐
    │ SOFT-    │──── pruning (>90d) ────► HARD-DELETED
    │ DELETED  │
    └──────────┘
```

Journal entries have a simpler lifecycle — no correction workflow.

---

## 5. Emergency Contact (SQLite Record)

### States

```
    ┌──────────┐
    │  ACTIVE  │──── user adds ──────► ACTIVE (is_primary can toggle)
    └────┬─────┘
         │ user removes
         v
    ┌──────────┐
    │ SOFT-    │──── pruning (>90d) ────► HARD-DELETED
    │ DELETED  │
    └──────────┘
```

---

## 6. SOS Alert (SQLite Record)

### States

```
    ┌──────────┐
    │ TRIGGERED│
    └────┬─────┘
         │
    ┌────┴────┐
    │         │
    v         v
┌────────┐ ┌──────────┐
│ CANCELLED│ │ RESOLVED │
└────────┘ └──────────┘
    │         │
    └────┬────┘
         v
    ┌──────────┐
    │ ARCHIVED │ (kept for history, never pruned)
    └──────────┘
```

| Transition | Trigger | Description |
|------------|---------|-------------|
| `TRIGGERED → CANCELLED` | User cancels SOS (`POST /safety/sos/{id}/cancel`) | False alarm flag set |
| `TRIGGERED → RESOLVED` | Emergency resolved (`POST /safety/sos/{id}/resolve`) | |
| `CANCELLED → ARCHIVED` | No further action needed | SOS history kept indefinitely |
| `RESOLVED → ARCHIVED` | No further action needed | |

SOS alerts are NEVER soft-deleted or pruned. They are archived for safety records.

---

## 7. Pregnancy Milestone (SQLite Record)

### States

```
    ┌──────────┐
    │ PENDING  │──── auto-completed ──► COMPLETED
    └──────────┘
         │ manual complete
         v
    ┌──────────┐
    │ COMPLETED│
    └──────────┘
```

Milestones are not deleted. They are RO records synced from the server.

---

## 8. Sync Log (Audit Trail)

### States

```
    ┌──────────┐
    │ STARTED  │
    └────┬─────┘
         │
    ┌────┴────┐
    │         │
    v         v
┌────────┐ ┌────────┐
│SUCCESS │ │ PARTIAL│── some ops failed
└────────┘ └────────┘
    │         │
    └────┬────┘
         v
    ┌──────────┐
    │ COMPLETED│
    └──────────┘

    ┌──────────┐
    │  FAILED  │── entire sync failed (network error mid-sync)
    └──────────┘
```

---

## 9. Data Flow Diagram (End-to-End)

```
User Action (e.g., "Save Journal")
    │
    ├── Online Path:
    │   POST /api/v1/wellness/journal ──► Server 200
    │       ├── offlineStore.remove(tempId) [PENDING → COMPLETED]
    │       ├── localDb.journal.upsert(serverData) [ACTIVE]
    │       └── qc.invalidateQueries(['wellness','journal'])
    │
    └── Offline Path:
        offlineStore.enqueue(op) [CREATED → PENDING]
            └── syncEngine.pushOperations() on reconnect
                ├── POST /sync/batch → 200 [PENDING → COMPLETED]
                │   ├── localDb.journal.upsert(serverData) [ACTIVE]
                │   └── cleanup temp data
                │
                ├── POST /sync/batch → 409 [PENDING → COMPLETED (conflict)]
                │   ├── localDb.journal.upsert(serverData) [OVERWRITTEN]
                │   └── Toast "Updated from another device"
                │
                └── POST /sync/batch → 5xx [PENDING → FAILED → PENDING (retry)]
                    └── after maxRetries → [FAILED → DISCARDED]
                        └── Toast "Save failed permanently"
```
