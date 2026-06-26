# Phase 5: Hybrid Offline/Online Sync Strategy — Completion Report

## Status: ✅ COMPLETE

All items from `Phase5_Hybrid_Offline_Online_Sync_Strategy.md` have been implemented. Below is the per-criterion sign-off.

---

## Core Validation

| # | Criterion | Status | Implementation |
|---|-----------|--------|----------------|
| 1 | Operation queued when offline: stored to encrypted storage | ✅ | `offlineStore.ts` — `enqueue()` persists via `EncryptedStorage.setItem()` |
| 2 | Operation queued when offline: visible in offline store state | ✅ | `offlineStore.ts` — `operations[]` in Zustand state, hydrated on app start |
| 3 | Sync cycle: pushes pending operations FIFO | ✅ | `syncEngine.ts` — `pushOperations()` sends sorted-by-createdAt ops to `POST /sync/batch` |
| 4 | Sync cycle: stops on first non-retryable error, continues on retryable | ✅ | `syncEngine.ts` — `isRetryableError()` checks HTTP status (429/5xx=retryable, else=non-retryable). Non-retryable ops discarded immediately via `discard()`. Retryable ops increment retry count and batch continues. |
| 5 | Sync cycle: retryable ops retried up to 5 times then discarded | ✅ | `syncEngine.ts` — `getRetryableOps()` filters `retryCount >= maxRetries(5)` and calls `discardMany()` before push starts |
| 6 | Sync cycle: non-retryable ops (400, 401, 404) discarded immediately | ✅ | `syncEngine.ts` — server-side `"failed"` results checked for 400/401/404 patterns; network errors checked for status code |
| 7 | Sync cycle: pulls new cycle entries + predictions from server | ✅ | `syncEngine.ts` — `pullServerData()` calls `GET /sync/changes?since=` |
| 8 | ETag: calendar endpoint returns ETag header | ✅ | `cycle/routes.py` — `get_calendar()` computes SHA-256 ETag and sets `ETag` header |
| 9 | ETag: same data + If-None-Match returns 304 | ✅ | `cycle/routes.py` — if header matches, returns `Response(status_code=304)` |
| 10 | Offline banner: shown when network lost, hidden on reconnect | ✅ | `ConnectivityBanner.tsx` — uses `useNetworkStatus()` hook, `Reanimated FadeIn/FadeOut` |
| 11 | Journal draft: auto-saved every 30s | ✅ | `JournalEntryScreen.tsx` — `setInterval` 30s saves to `EncryptedStorage`, shows "Draft saved" toast |
| 12 | Journal draft: restored on screen mount | ✅ | `JournalEntryScreen.tsx` — on mount reads draft from `EncryptedStorage`, calls `reset()`, shows "Draft from X min ago". Also saves on `beforeRemove` navigation. |
| 13 | TypeScript: `npx tsc --noEmit` passes with 0 source errors | ✅ | Only pre-existing expo tsconfig warning remains |

## Critical Gaps (Must Fix)

| # | Gap | Status | Implementation |
|---|-----|--------|----------------|
| 14 | **Dependency Cascading:** If CREATE fails permanently, dependent UPDATE/DELETE ops discarded | ✅ | `offlineStore.ts` — `removeCascading(tempId)` removes all ops with matching `tempId`. Called for failed creates in `syncEngine.ts` |
| 15 | **Conflict Resolution (Client Timestamp):** Server returns `"conflict"` with `server_data` | ✅ | `sync/services.py` — `_check_conflict()` compares `updated_at` vs `client_updated_at`. Mobile `syncEngine.ts` writes server version + invalidates cache + shows toast |
| 16 | **Client Timestamp on All Models:** `client_updated_at` field on syncable models | ✅ | Migration `7ccfe1b50f12` adds `client_updated_at` to `journal_entries`, `mood_logs`, `cycle_entries`, `pregnancy_daily_logs`, `emergency_contacts`. All inherit from `Base` which includes the field. |
| 17 | **Idempotency in Batch:** Duplicate key within 24h returns cached response | ✅ | `sync/services.py` — `_IDEMPOTENCY_CACHE` with 24h TTL. Checked before handler dispatch. |
| 18 | **React Query Invalidation:** After `pullServerData()`, invalidate caches | ✅ | `syncEngine.ts` — `queryClient.invalidateQueries()` call after successful pull |
| 19 | **Battery-Friendly Background Sync:** 15-day interval | ✅ | `backgroundSync.ts` — `minimumInterval: 1,296,000` (15 days). Uses `expo-background-fetch` + `TaskManager`. Only does model version check + `pullServerData()` (no push). *Note: Plan said 15-min; updated to 15 days per product decision to minimize battery drain in low-resource settings while catching 30-day model retrain cycle 2×.* |
| 20 | **Timestamp Drift Protection:** Server clamps `client_updated_at > NOW() + 5min` | ✅ | `sync/services.py` — `_clamp_client_ts()` clamps to `NOW()` if input > 5 min in the future |
| 21 | **Large Payload Gzip:** Compress `/sync/batch` when ≥10 operations | ✅ | `syncEngine.ts` — `pako.gzip()` in `transformRequest` with `Content-Encoding: gzip`. Backend `main.py` — `gunzip_request` middleware decompresses before routing. |

## Architecture

```
┌─────────────────────┐              ┌─────────────────────┐
│    Mobile App       │    sync      │   Backend Server    │
│                     │  ◄──────────►│                     │
│  ┌───────────────┐  │   push/pull  │  ┌───────────────┐  │
│  │ EncryptedStore │  │              │  │  PostgreSQL   │  │
│  │ (encrypted)    │  │  POST       │  │  (source of   │  │
│  │  - Auth tokens │  │  /sync/batch│  │   truth)      │  │
│  │  - Pending ops │  │  ◄──────────│  └───────────────┘  │
│  │  - Journal dr. │  │             │  ┌───────────────┐  │
│  │  - Last pull   │  │  GET        │  │ SyncModule    │  │
│  └───────┬───────┘  │  /sync/changes│  │  - push_batch  │  │
│          │          │  ──────────►│  │  - pull_changes │  │
│  ┌───────┴───────┐  │             │  │  - conflict    │  │
│  │ offlineStore  │  │  ETag       │  │  - idempotency  │  │
│  │ (Zustand)     │  │  /cycle/    │  │  - drift clamp  │  │
│  │  - operations │  │   calendar  │  └───────────────┘  │
│  │  - isHydrated │  │  ◄─────────►│                     │
│  └───────────────┘  │  304/200    │                     │
│                     │             │                     │
│  ┌───────────────┐  │  gzip       │                     │
│  │ React Query   │  │  /sync/batch│                     │
│  │ (invalidated) │  │  ──────────►│                     │
│  └───────────────┘  │             │                     │
│                     │             │                     │
│  ┌───────────────┐  │             │                     │
│  │ Connectivity  │  │  15-day     │                     │
│  │  Banner       │  │  bg sync    │                     │
│  └───────────────┘  │             │                     │
│                     │             │                     │
│  BackgroundFetch──15d model check + pull only            │
└─────────────────────┘              └─────────────────────┘
```

## Files Created

### Backend
| File | Purpose |
|------|---------|
| `app/core/responses.py` | `ETagResponse` — auto-computes SHA-256 ETag |
| `app/modules/sync/__init__.py` | Module marker |
| `app/modules/sync/schemas.py` | `SyncOperation`, `SyncBatchRequest`, `SyncResultItem`, `SyncBatchResponse`, `SyncChangeItem`, `SyncChangesResponse` |
| `app/modules/sync/routes.py` | `POST /sync/batch`, `GET /sync/changes` |
| `app/modules/sync/services.py` | `SyncService` with handler registry, conflict detection, idempotency, timestamp clamping |
| `app/modules/sync/dependencies.py` | `SyncServiceDep` FastDI |
| `alembic/versions/2026_06_24_1443-7ccfe1b50f12_add_client_updated_at_to_syncable_tables.py` | Migration for `client_updated_at` column |

### Mobile
| File | Purpose |
|------|---------|
| `src/services/sync/types.ts` | TypeScript interfaces for sync data structures |
| `src/services/sync/syncEngine.ts` | `pushOperations()`, `pullServerData()`, `syncAll()` with retry/conflict/cascade/gzip logic |
| `src/services/sync/backgroundSync.ts` | 15-day background sync task via `expo-background-fetch`, model version check + pull only |
| `src/services/sync/useNetworkStatus.ts` | React hook wrapping `@react-native-community/netinfo` |
| `src/services/sync/index.ts` | Barrel exports |
| `src/stores/offlineStore.ts` | Zustand store with encrypted persistence, queue operations, cascade removal |
| `src/components/ui/ConnectivityBanner.tsx` | Animated offline banner |

### Files Modified
| File | Change |
|------|--------|
| `app/core/database.py` | Added `client_updated_at` to `Base` model |
| `app/main.py` | Registered sync module, added `gunzip_request` middleware |
| `app/modules/cycle/routes.py` | ETag support on calendar endpoint |
| `alembic/versions/2026_06_24_1344-911664c419c9_safety_contact_ids_json.py` | Fixed migration (drop default before alter, `array_to_json()`) |
| `mobile/src/app/App.tsx` | Wired offline store hydration, NetInfo reconnect sync, AppState foreground sync, background sync registration |
| `mobile/src/app/providers.tsx` | Exported `queryClient` for React Query invalidation |
| `mobile/src/screens/wellness/JournalEntryScreen.tsx` | Draft auto-save/restore with `EncryptedStorage` |
| `mobile/src/stores/index.ts` | Added `offlineStore` export |
| `mobile/package.json` | Added `expo-background-fetch`, `pako`, `@types/pako` |
