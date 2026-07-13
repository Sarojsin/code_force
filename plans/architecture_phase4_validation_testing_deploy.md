# Architecture Phase 4: Validation, Testing & Deployment Gate

**Priority:** High (3 days)
**Dependencies:** Phases 1-3 complete
**Files touched:** 8 (4 test files, 2 E2E config files, 1 CI config, 1 playwright/detox config)

---

## 1. Objective

Build a comprehensive test suite that validates the offline-first architecture end-to-end, with CI gates that prevent regressions. The golden rule: **if Phase 1-3 works offline but a future change breaks it, a test must fail.**

| Sub-task | Effort | Success Metric |
|----------|--------|----------------|
| 4a. Unit tests for offline queue + sync engine | 1 day | 90%+ coverage on `offlineStore`, `syncEngine`, `isNetworkError` |
| 4b. Integration tests for mutation hooks | 1 day | All 11 mutation hooks tested for offline fallback path |
| 4c. E2E tests (Detox) | 0.5 day | Offline → write → online → verify flows work |
| 4d. CI configuration + deploy gate | 0.5 day | PRs blocked if any offline test fails |

---

## 2. Current State (Before)

- **Unit tests exist** for `offlineStore` (`tests/`) — good foundation
- **No tests exist** for mutation hooks (the 11 hooks in `queries/`)
- **No tests exist** for `syncEngine.pushOperations()`, `pullServerData()`, `isNetworkError()`
- **No E2E tests** for offline scenarios
- **No CI gate** that specifically enforces offline behavior
- **🔴 E2E network simulation** relies on flaky `device.setStatusBar` — not reliable across CI environments
- **🔴 Cache restoration** after `persistQueryClient` is untested — silent fallback to network-only on failure
- **🟡 Mutation hook coverage** lacks a dedicated threshold — 11 critical offline-path files at risk

---

## 3. Phase 4a: Unit Tests

### 3.1 `isNetworkError()` Test

**File:** `src/services/sync/__tests__/isNetworkError.test.ts`

```typescript
import { AxiosError, AxiosHeaders } from 'axios';
import { isNetworkError } from '../isNetworkError';

describe('isNetworkError', () => {
  it('returns true for network error with no response', () => {
    const error = new AxiosError('Network Error', 'ECONNABORTED', undefined as any);
    expect(isNetworkError(error)).toBe(true);
  });

  it('returns true for 5xx server errors', () => {
    const error = new AxiosError('Server Error', '500', undefined as any, undefined as any, {
      status: 500, data: {}, statusText: 'Internal Server Error',
      headers: {}, config: { headers: new AxiosHeaders() },
    });
    expect(isNetworkError(error)).toBe(true);
  });

  it('returns false for 4xx client errors', () => {
    const error = new AxiosError('Not Found', '404', undefined as any, undefined as any, {
      status: 404, data: {}, statusText: 'Not Found',
      headers: {}, config: { headers: new AxiosHeaders() },
    });
    expect(isNetworkError(error)).toBe(false);
  });

  it('returns false for 422 validation errors', () => {
    const error = new AxiosError('Validation Failed', '422', undefined as any, undefined as any, {
      status: 422, data: {}, statusText: 'Unprocessable Entity',
      headers: {}, config: { headers: new AxiosHeaders() },
    });
    expect(isNetworkError(error)).toBe(false);
  });

  it('returns true for TypeError with network message', () => {
    const error = new TypeError('Network request failed');
    expect(isNetworkError(error)).toBe(true);
  });

  it('returns false for generic Error', () => {
    const error = new Error('Something went wrong');
    expect(isNetworkError(error)).toBe(false);
  });
});
```

### 3.2 `offlineStore` Tests (Extend Existing)

**File:** `src/stores/__tests__/offlineStore.test.ts`

```typescript
import { useOfflineStore } from '../offlineStore';

// Reset store before each test
beforeEach(() => {
  useOfflineStore.setState({ operations: [], isHydrated: true });
});

describe('offlineStore.enqueue', () => {
  it('adds operation with generated id, createdAt, retryCount=0', async () => {
    const id = await useOfflineStore.getState().enqueue({
      type: 'journal/create',
      data: { content: 'test' },
      tempId: 'temp_1',
      idempotencyKey: 'idem_1',
      clientUpdatedAt: new Date().toISOString(),
      priority: 'normal',
    });
    const op = useOfflineStore.getState().operations[0];
    expect(op.id).toBe(id);
    expect(op.type).toBe('journal/create');
    expect(op.retryCount).toBe(0);
    expect(op.maxRetries).toBe(5);
    expect(op.createdAt).toBeDefined();
    expect(op.data.content).toBe('test');
  });

  it('stores operations in FIFO order', async () => {
    await useOfflineStore.getState().enqueue({
      type: 'journal/create', data: { content: 'first' }, tempId: 't1',
      idempotencyKey: 'ik1', clientUpdatedAt: '2025-01-01T00:00:00Z', priority: 'normal',
    });
    await useOfflineStore.getState().enqueue({
      type: 'mood/create', data: { mood: 'happy' }, tempId: 't2',
      idempotencyKey: 'ik2', clientUpdatedAt: '2025-01-01T00:01:00Z', priority: 'normal',
    });
    expect(useOfflineStore.getState().operations).toHaveLength(2);
    expect(useOfflineStore.getState().operations[0].type).toBe('journal/create');
  });
});

describe('offlineStore.remove', () => {
  it('removes operation by id', async () => {
    const id = await useOfflineStore.getState().enqueue({
      type: 'journal/create', data: {}, tempId: 't1',
      idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
    });
    await useOfflineStore.getState().remove(id);
    expect(useOfflineStore.getState().operations).toHaveLength(0);
  });
});

describe('offlineStore.getPendingOperations', () => {
  it('excludes operations with retryCount >= maxRetries', async () => {
    await useOfflineStore.getState().enqueue({
      type: 'journal/create', data: {}, tempId: 't1',
      idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
    });
    const op = useOfflineStore.getState().operations[0];
    // Manually set retryCount to max
    useOfflineStore.setState({
      operations: [{ ...op, retryCount: 5 }],
    });
    expect(useOfflineStore.getState().getPendingOperations()).toHaveLength(0);
  });
});

describe('offlineStore.hydrate', () => {
  it('restores operations from EncryptedStorage', async () => {
    // This test requires mocking EncryptedStorage
    // Mock: EncryptedStorage.getItem returns JSON array with one operation
    // Then call hydrate() and verify operations are restored
  });
});
```

### 3.3 `syncEngine` Tests

### 3.4 🔴 Critical Gap: persistQueryClient Cache Restoration Test

**Problem:** Phase 1b added `persistQueryClient` with AsyncStorage, but the E2E test only validates that data *appears* after force-quit. It does not test that `persistQueryClient` actually restores the cache during startup. If the persister fails (schema mismatch, buster bump, AsyncStorage corruption), the app silently falls back to network-only.

**Fix:** Add a unit test that verifies cache restoration at the provider level.

**File:** `src/app/__tests__/providers.test.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('persistQueryClient', () => {
  it('restores cached data from AsyncStorage on app start', async () => {
    // 1. Seed AsyncStorage with cache data
    await AsyncStorage.setItem('REACT_QUERY_OFFLINE_CACHE', JSON.stringify({
      clientState: {
        '["cycle","calendar"]': {
          state: { data: { days: ['2025-01-01'] } }
        }
      }
    }));

    // 2. Create new QueryClient with persistQueryClient
    const qc = new QueryClient();
    const persister = createAsyncStoragePersister({ storage: AsyncStorage });

    await persistQueryClient({
      queryClient: qc,
      persister,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      buster: 'v1',
    });

    // 3. Verify data is restored
    const data = qc.getQueryData(['cycle', 'calendar']);
    expect(data).toEqual({ days: ['2025-01-01'] });
  });
});
```

**Why this matters:** If `persistQueryClient` fails to restore the cache, the app falls back to network-only. This test catches that silently broken state before it ships.

**File:** `src/services/sync/__tests__/syncEngine.test.ts`

```typescript
import { syncAll, pushOperations, pullServerData } from '../syncEngine';
import { useOfflineStore } from 'src/stores/offlineStore';
import { useAuthStore } from 'src/stores/authStore';

// Mock dependencies
jest.mock('src/services/api/client');
jest.mock('src/services/storage');

beforeEach(() => {
  useOfflineStore.setState({ operations: [], isHydrated: true });
  useAuthStore.setState({ user: { id: 'user1', email: 'test@test.com' } });
});

describe('syncAll', () => {
  it('does nothing if already syncing', async () => {
    // Start first sync
    const promise1 = syncAll();
    // Attempt second sync — should return immediately
    // This tests the _isSyncing guard
  });

  it('skips sync if no authenticated user', async () => {
    useAuthStore.setState({ user: null });
    await expect(syncAll()).resolves.not.toThrow();
  });

  it('pushes pending operations, then pulls server data', async () => {
    // Add operation to queue
    await useOfflineStore.getState().enqueue({
      type: 'journal/create', data: { content: 'test' }, tempId: 't1',
      idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
    });
    // Mock API responses
    // Mock POST /sync/batch returns success
    // Mock GET /sync/changes returns empty
    await syncAll();
    // Verify queue is empty after successful sync
    expect(useOfflineStore.getState().operations).toHaveLength(0);
  });
});
```

---

## 4. Phase 4b: Integration Tests for Mutation Hooks

### 4.1 Test Pattern

Each hook test verifies two paths:
1. **Online path**: API succeeds → `onSuccess` called, cache invalidated
2. **Offline path**: API fails with NetworkError → `offlineStore.enqueue()` called

**File:** `src/services/queries/__tests__/wellness.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateJournalEntry, wellnessKeys } from '../wellness';
import { wellnessService } from 'src/services/api/wellness';
import { useOfflineStore } from 'src/stores/offlineStore';

jest.mock('src/services/api/wellness');
jest.mock('src/services/storage');

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } } });
  return ({ children }: any) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useOfflineStore.setState({ operations: [], isHydrated: true });
});

describe('useCreateJournalEntry', () => {
  it('calls API and invalidates journal cache on success', async () => {
    (wellnessService.createJournalEntry as jest.Mock).mockResolvedValue({ id: '1', content: 'test' });

    const { result, waitFor } = renderHook(() => useCreateJournalEntry(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ content: 'test' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(wellnessService.createJournalEntry).toHaveBeenCalledWith({ content: 'test' });
  });

  it('enqueues to offlineStore on network error', async () => {
    (wellnessService.createJournalEntry as jest.Mock).mockRejectedValue(
      new TypeError('Network request failed')
    );

    const { result, waitFor } = renderHook(() => useCreateJournalEntry(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ content: 'offline test' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const pending = useOfflineStore.getState().operations;
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('journal/create');
    expect(pending[0].data.content).toBe('offline test');
  });

  it('does NOT enqueue on 4xx validation error', async () => {
    (wellnessService.createJournalEntry as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { error: 'Validation failed' } },
    });

    const { result, waitFor } = renderHook(() => useCreateJournalEntry(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ content: '' }); // empty content = validation error
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useOfflineStore.getState().operations).toHaveLength(0);
  });
});
```

### 4.2 Create Tests for All 11 Hooks

Write the same pattern for:

| Hook File | Hooks to Test |
|-----------|---------------|
| `queries/cycle.ts` | `useCreateCycleEntry`, `useUpdateCycleEntry`, `useLogCorrection`, `useLogSnooze` |
| `queries/wellness.ts` | `useCreateJournalEntry`, `useCreateMoodLog`, `useCompleteBreathingSession` |
| `queries/safety.ts` | `useCreateEmergencyContact`, `useUpdateEmergencyContact`, `useDeleteEmergencyContact`, `useTriggerSos` |

Shared assertions for each:
- On network error → `offlineStore.operations` length increases by 1
- On 4xx error → `offlineStore.operations` length unchanged
- On success → cache invalidation triggered

---

## 5. Phase 4c: E2E Tests (Detox)

### 5.1 Critical Gap: E2E Network Simulation is Unreliable

**Problem:** `device.setStatusBar({ network: 'wifi' })` is not guaranteed to work across all Detox environments (iOS Simulator vs Android Emulator vs real device). The Detox API for toggling network is limited and unreliable.

**Fix:** Use environment variables + feature flags to simulate offline mode in E2E tests.

Add an offline simulation flag in the app:

```typescript
// src/services/sync/useNetworkStatus.ts
const IS_E2E = process.env.E2E_TEST === 'true';

export function useNetworkStatus() {
  const e2eOffline = __DEV__ && process.env.E2E_TEST_OFFLINE === 'true';
  const actualStatus = useNetInfo();

  return {
    isConnected: e2eOffline ? false : actualStatus.isConnected,
  };
}
```

In the E2E test, set the environment variable via launch args:

```typescript
// e2e/offline.test.ts
const launchOffline = async () => {
  await device.launchApp({
    newInstance: true,
    launchArgs: { E2E_TEST_OFFLINE: 'true' },
  });
};

const launchOnline = async () => {
  await device.launchApp({
    newInstance: true,
    launchArgs: { E2E_TEST_OFFLINE: 'false' },
  });
};
```

**Why this matters:** `device.setStatusBar` is flaky. Using environment variables gives you deterministic, repeatable control over the app's network state in CI.

### 5.2 Test Scenarios

**File:** `mobile/e2e/offline.test.ts`

```typescript
describe('Offline-First Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await element(by.id('login-screen')).waitToBeVisible();
    // Login via test credentials
    await element(by.id('email-input')).typeText('test@shecare.app');
    await element(by.id('password-input')).typeText('testpass123');
    await element(by.id('login-button')).tap();
    await element(by.id('dashboard-screen')).waitToBeVisible(10000);
  });

  it('queues journal entry when offline and syncs when online', async () => {
    // 1. Go offline
    await device.setStatusBar({ network: 'wifi' }); // This may not exist — use airplane mode
    // Alternative: use development tool to mock NetInfo

    // 2. Navigate to journal
    await element(by.id('journal-tab')).tap();
    await element(by.id('new-entry-button')).tap();

    // 3. Write entry
    await element(by.id('journal-title')).typeText('Offline Test Entry');
    await element(by.id('journal-content')).typeText('This was written offline.');
    await element(by.id('save-entry-button')).tap();

    // 4. Verify offline toast
    await expect(element(by.text('Saved offline'))).toBeVisible();

    // 5. Go online
    // Reconnect network

    // 6. Verify sync
    // Wait for sync engine to process
    await expect(element(by.text('Offline Test Entry'))).toBeVisible();

    // 7. Verify no pending operations
    // Navigate away and back — entry should have real server ID
  });

  it('triggers SOS SMS fallback when offline', async () => {
    // 1. Go offline
    // 2. Navigate to SOS screen
    // 3. Trigger SOS
    // 4. Verify SMS app was opened (platform-specific)
    // 5. Verify SOS active screen shown
    // 6. Go online
    // 7. Verify SOS synced to server
  });

  it('loads calendar from cache after force-quit', async () => {
    // 1. Load calendar data (online)
    // 2. Force-quit app
    // 3. Go offline
    // 4. Relaunch app
    // 5. Calendar should show data immediately (no spinner)
  });
});
```

### 5.3 E2E Configuration

Update `.detoxrc.json`:

```json
{
  "testRunner": "jest",
  "runnerConfig": "e2e/config.json",
  "configurations": {
    "ios.sim.debug": {
      "binaryPath": "ios/build/Build/Products/Debug-iphonesimulator/SheCare.app",
      "build": "xcodebuild -workspace ios/SheCare.xcworkspace -scheme SheCare -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build",
      "type": "ios.simulator",
      "device": { "type": "iPhone 14" }
    }
  },
  "testTimeout": 60000,
  "launchArgs": { "E2E_TEST_OFFLINE": "false" },
  "artifacts": {
    "plugins": { "uiHierarchy": "enabled", "screenshot": "enabled" }
  }
}
```

### 5.4 🟡 Force-Quit Coverage Refinement

The "loads calendar from cache after force-quit" test must use `device.terminateApp()` + `device.launchApp()` — not `device.shutdown()` which deletes the app sandbox (and the cache with it).

```typescript
it('loads calendar from cache after force-quit', async () => {
  // 1. Load calendar data (online)
  await expect(element(by.id('calendar-screen')).waitToBeVisible());
  // Calendar loads with data from API

  // 2. Close app (force-quit)
  await device.terminateApp();

  // 3. Relaunch offline
  await device.launchApp({
    newInstance: true,
    launchArgs: { E2E_TEST_OFFLINE: 'true' },
  });

  // 4. Calendar should show data immediately (no spinner)
  await expect(element(by.id('calendar-list'))).toBeVisible();
  await expect(element(by.text('2025-01-01'))).toBeVisible();
});
```

Document this flow in the E2E test file comments.

---

## 6. Phase 4d: CI Configuration & Deploy Gate

### 6.1 CI Steps (GitHub Actions)

**File:** `.github/workflows/mobile-ci.yml`

```yaml
name: Mobile CI

on:
  pull_request:
    paths: ['mobile/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mobile

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: mobile/package-lock.json

      - run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Lint
        run: npx eslint src/

      - name: Unit & Integration tests
        run: npx jest --coverage --coverageThreshold='{"global":{"lines":80,"functions":80,"branches":75},"./src/services/queries/":{"lines":95,"functions":95}}'
        env:
          CI: true
          E2E_TEST_OFFLINE: 'false'
          DETOX_CONFIG: 'ios.sim.debug'

      - name: Bundle size check
        run: npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/bundle.js

  e2e-ios:
    runs-on: macos-14
    defaults:
      run:
        working-directory: mobile

    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx detox build --configuration ios.sim.debug
      - run: npx detox test --configuration ios.sim.debug --cleanup
        env:
          CI: true
```

### 6.2 Pre-commit Hook

**File:** `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky"

cd mobile

# TypeScript
npx tsc --noEmit || exit 1

# Lint staged files
npx lint-staged || exit 1

# Unit tests (fast — only changed files)
npx jest --bail --findRelatedTests $(git diff --cached --name-only | grep '\.tsx\?$') || exit 1
```

**File:** `.lintstagedrc.json`

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

---

## 7. Validation Gate

Before merging any PR that touches offline-related code:

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. Lint
npx eslint src/

# 3. Unit + Integration (80% global, 95% queries)
npx jest --coverage --coverageThreshold='{"global":{"lines":80,"functions":80,"branches":75},"./src/services/queries/":{"lines":95,"functions":95}}'

# 4. E2E (if Detox environment available)
npx detox test e2e/offline.test.ts --configuration ios.sim.debug

# 5. Manual offline checklist (must pass all)
```

### 7.1 Manual Offline Checklist (CI-equivalent)

| # | Test | Pass/Fail |
|---|------|-----------|
| 1 | Offline: write journal → "Saved offline" toast → appears in list | [ ] |
| 2 | Offline: log mood → "Saved offline" toast → appears in history | [ ] |
| 3 | Offline: log period → "Saved offline" toast → calendar updated | [ ] |
| 4 | Offline: add emergency contact → "Saved offline" → in list | [ ] |
| 5 | Offline: trigger SOS → SMS app opens → "SOS sent" toast | [ ] |
| 6 | Online: all writes go to API normally (not queued) | [ ] |
| 7 | Reconnect: queue drains, data on server | [ ] |
| 8 | Force-quit + relaunch: calendar loads instantly (no spinner) | [ ] |
| 9 | First launch (offline, no cache): ErrorState shown | [ ] |
| 10 | ConnectivityBanner: correct queue count when offline | [ ] |

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tests pass in CI but fail on device | Medium | High | Run E2E on both iOS Sim + Android Emulator |
| Flaky E2E tests (timing) | High | Medium | Use `waitFor` with generous timeouts, retry flaky tests |
| Mocked storage differs from real EncryptedStorage | Medium | High | Add integration test with real EncryptedStorage |
| Coverage target (80%) blocks legitimate PRs | Low | Medium | Code review can override for non-critical paths |
| E2E network simulation via `device.setStatusBar` fails in CI | High | High | Use `E2E_TEST_OFFLINE` launch arg with `useNetworkStatus` override |
| `persistQueryClient` silently fails to restore cache | Low | High | Dedicated unit test (`providers.test.ts`) validates restoration |
| Force-quit E2E test deletes app sandbox (cache lost) | Medium | High | Use `device.terminateApp()` — never `device.shutdown()` |

---

## 9. Deploy Gate

```bash
# MUST PASS before merging
cd mobile
npx tsc --noEmit && npx eslint src/ && npx jest --coverage --coverageThreshold='{"global":{"lines":80,"functions":80,"branches":75},"./src/services/queries/":{"lines":95,"functions":95}}'
echo "✅ CI Gate Passed"
```
