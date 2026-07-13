# Architecture Phase 0: Overview & Data Flow

**A high-level map of the entire offline-first architecture.** Read this first to understand how the 5 phases fit together, then dive into the individual phase plans for implementation details.

---

## 1. Architecture Diagram (Final State)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MOBILE APP                                    │
│                                                                       │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│  │  SCREENS      │    │  REACT QUERY      │    │  OFFLINE STORE   │   │
│  │  (53 screens) │───►│  (cache layer)    │◄───│  (Zustand +      │   │
│  │               │    │                   │    │   EncryptedStorage)│ │
│  │  CycleDash   │    │  staleTime: 5min  │    │                   │   │
│  │  JournalList │    │  gcTime: 24h      │    │  PendingOperation │   │
│  │  MoodLog     │    │  networkMode:     │    │  []               │   │
│  │  SOSActive   │    │    offlineFirst   │    │                   │   │
│  │  PeriodLog   │    │  Persisted to     │    │  enqueue()        │   │
│  │  ...         │    │  AsyncStorage     │    │  remove()         │   │
│  └──────┬───────┘    └────────┬─────────┘    └────────┬─────────┘     │
│         │                     │                        │              │
│         │     ┌───────────────┴────────────────────────┘              │
│         │     │               │                                       │
│         ▼     ▼               ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    SYNC ENGINE                                │   │
│  │                                                               │   │
│  │  pushOperations() → POST /sync/batch (gzip if >=10 ops)       │   │
│  │  pullServerData() → GET  /sync/changes?since=<timestamp>      │   │
│  │                                                               │   │
│  │  Triggers: NetInfo reconnect, AppState foreground,            │   │
│  │            BackgroundFetch (15 min for now testing purposes)   │   │
│  │            but in production 15 days,                          │   │
│  │            manual pull-to-refresh )                            │   │
│  └─────────────────────┬─────────────────────────────────────────┘   │
│                        │                                             │
│                        ▼                                             │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    API CLIENT (axios)                         │   │
│  │  baseURL: /api/v1                                             │   │
│  │  interceptors: token refresh, X-Request-ID, Sentry tags       │   │
│  └─────────────────────┬─────────────────────────────────────────┘   │
│                        │                                             │
└────────────────────────┼─────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   BACKEND SERVER     │
              │   (FastAPI)          │
              │                      │
              │  87 endpoints        │
              │  13 modules          │
              │  PostgreSQL + Redis  │
              └──────────────────────┘
```

## 2. Data Flow: Three Paths

### Path A: Online — Normal Write

```
User taps Save
  → useMutation.mutate()
  → mutationFn: api.post(endpoint, data)
  → API responds 200
  → onSuccess: invalidateQueries()
  → Screen re-renders with fresh data
  → Toast: "Saved!" (success)
  Duration: ~200-500ms
```

### Path B: Offline — Queued Write

```
User taps Save (offline)
  → useMutation.mutate()
  → mutationFn: api.post(endpoint, data)
  → NetworkError (no response)
  → onError: isNetworkError() = true
  → offlineStore.enqueue({ type, data, tempId, ... })
  → Toast: "Saved offline — will sync when online"
  → qc.setQueryData(key, (old) => [data, ...old])  // Optimistic UI update
  → Data appears in UI immediately
  Duration: ~50ms (no network needed)
```

### Path C: Sync — Queue Drains

```
NetInfo fires: isConnected = true
  OR
AppState changes to 'active'
  OR
BackgroundFetch timer fires

  → syncAll()
    → pushOperations()
      → POST /sync/batch with all pending ops
      → For each result:
        - success: store.remove(id)
        - conflict: server_data wins, store.remove(id)
        - 4xx: store.discard(id)
        - 5xx: store.incrementRetry(id)
    → pullServerData()
      → GET /sync/changes?since=lastPull
      → new changes → queryClient.invalidateQueries()
    → Screen re-renders with server data
```

## 3. Layer Responsibilities

| Layer | Responsibility | Technology |
|-------|---------------|------------|
| **Screens** | Render UI, handle user input, call mutation hooks | React Native |
| **Query Hooks** | Encapsulate API calls + offline fallback + optimistic updates | TanStack Query + Zustand |
| **React Query Cache** | In-memory cache + AsyncStorage persistence | `@tanstack/react-query` + `persistQueryClient` |
| **Offline Store** | Queue of pending operations, persisted to encrypted storage | Zustand + `EncryptedStorage` |
| **Sync Engine** | Push pending ops, pull server changes, conflict resolution | Custom TypeScript |
| **Safety Queue** | Separate SOS queue with priority ordering + SMS fallback | Custom TypeScript + native SMS |
| **ML Models** | On-device cycle prediction + wellness classification | ONNX Runtime + bundled fallback |
| **API Client** | HTTP transport, token refresh, correlation IDs | axios |

## 4. Storage Strategy

| What | Where | Why |
|------|-------|-----|
| React Query cache | `AsyncStorage` (plain) | Key `REACT_QUERY_OFFLINE_CACHE` — read cache is non-sensitive |
| Pending operations | `EncryptedStorage` | Key `shecare.offline.queue` — may contain analysis data |
| SOS queue | `EncryptedStorage` | Key `shecare.safety.offlineQueue` — emergency data |
| Auth tokens | `EncryptedStorage` | Keys `shecare.accessToken`, `shecare.refreshToken` |
| User profile | `EncryptedStorage` | Key `shecare.user` |
| Journal drafts | `EncryptedStorage` | Key `shecare.journal.draft.{id}` — per-user encrypted |
| ML models | `EncryptedStorage` | Keys `global_model_json`, `wellness_model_version`, etc. |
| Sync metrics | `AsyncStorage` | Key `shecare.sync.metrics` — aggregate, non-sensitive |
| Cycle snooze state | `AsyncStorage` (currently) | **GAP** — should move to EncryptedStorage |

## 5. Phase Dependency Graph

```
Phase 0 (this doc) — overview & data flow
  │
  ▼
Phase 1 (critical, 3 days) — Offline Queue + Cache Persistence
  ├── Wire 11 mutation hooks to offlineStore.enqueue()
  └── Enable persistQueryClient with AsyncStorage
  │
  ▼
Phase 2 (high, 2.5 days) — SOS + Cycle + Period
  ├── SOS SMS fallback (safetySyncQueue + native SMS)
  ├── Cycle model background downloader
  └── Period log entry (fix data-loss bug)
  │
  ▼
Phase 3 (medium, 1.5 days) — UI Polish + Network-Aware UX
  ├── ConnectivityBanner with real queue count
  ├── Stale-while-revalidate loading patterns
  └── Network-aware error boundaries
  │
  ▼
Phase 4 (high, 3 days) — Testing + CI Gate
  ├── Unit tests (isNetworkError, offlineStore, syncEngine)
  ├── Integration tests (all 11 mutation hooks)
  ├── E2E tests (Detox: offline → write → online → verify)
  └── CI configuration (GitHub Actions, pre-commit hooks)
  │
  ▼
Phase 5 (medium, 2 days) — Monitoring + Observability
  ├── Structured sync logging
  ├── Sentry breadcrumbs for offline events
  ├── Sync health metrics store
  └── Dev offline dashboard screen
```

## 6. Key Metrics

| Metric | Phase 1 Target | Phase 5 Target |
|--------|---------------|---------------|
| Offline write → UI appearance | < 100ms | < 100ms |
| Offline → online sync drain | < 5s for 50 ops | < 3s for 50 ops |
| App restart → cache load | N/A (no cache) | < 500ms |
| Sync failure rate | N/A (not tracked) | < 1% |
| Queue persistence | Survives app restart | Survives app restart, 7-day TTL |

## 7. Risk Register

| # | Risk | Phase | Mitigation |
|---|------|-------|-----------|
| R1 | Offline queue grows unbounded | 1 | `maxRetries: 5` discard, no unbounded growth |
| R2 | Cache takes too much AsyncStorage space | 1 | `maxAge: 7 days`, whitelist essential keys only |
| R3 | Native SMS opens wrong app/contact | 2 | `sendSmsFallback` opens default SMS app; user must tap Send |
| R4 | E2E tests flaky on CI | 4 | Retry flaky tests (max 2), generous timeouts |
| R5 | Sentry breadcrumb spam in offline mode | 5 | Throttle to 1 breadcrumb per 10s for same event type |

## 8. Quick Start: Implementation Order

```bash
# 1. Start here — understand the architecture
cat plans/architecture_phase0_overview_dataflow.md

# 2. Implement Phase 1 (critical foundation)
cat plans/architecture_phase1_offline_write_queue_persistence.md

# 3. Implement Phase 2 (safety + cycle features)
cat plans/architecture_phase2_sos_cycle_period.md

# 4. Implement Phase 3 (UI polish)
cat plans/architecture_phase3_ui_polish_network_ux.md

# 5. Implement Phase 4 (testing + CI)
cat plans/architecture_phase4_validation_testing_deploy.md

# 6. Implement Phase 5 (monitoring)
cat plans/architecture_phase5_monitoring_observability.md
```

## 9. Files Changed Summary (All Phases)

| Phase | Files | Lines Changed (est.) |
|-------|-------|---------------------|
| 1 | 14 (11 hooks + 1 provider + 1 helper + 1 store) | ~350 |
| 2 | 5 (1 screen + 1 service + 1 ML + 1 store + 1 hook) | ~150 |
| 3 | 4 (1 component + 1 hook + 2 components) | ~200 |
| 4 | 8 (4 test files + 2 config + 1 CI + 1 E2E) | ~500 |
| 5 | 6 (1 logging + 1 app + 1 engine + 1 wrapper + 1 ML + 1 metrics) | ~250 |
| **Total** | **37 files** | **~1,450 lines** |
