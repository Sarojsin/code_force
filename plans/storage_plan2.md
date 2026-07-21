# Storage Plan 2: SQLite Database Layer Setup

**Priority:** Critical (1.5 days)
**Dependencies:** Plan 1 (schema and API shape inventory must be complete)
**Phase:** Phase 2 (SQLite Integration)

---

## 1. Objective

Add the SQLite database engine to the mobile app, configure the Drizzle ORM connection, wire migrations into app startup, and verify the database is operational. By the end of this plan, the app has a working SQLite database with the correct schema that survives app restarts.

---

## 2. Deliverables

| Deliverable | Output | Acceptance Criteria |
|-------------|--------|---------------------|
| 2a. Dependencies installed | `package.json` updated | `expo-sqlite`, `drizzle-orm`, `drizzle-kit` added |
| 2b. DB connection singleton | `src/db/connection.ts` | Exports `db` and `migrateDb` — one connection, no leaks |
| 2c. Schema + migration | `src/db/schema.ts`, `src/db/migrations/` | From Plan 1; migration file generated and verified |
| 2d. App startup wiring | `src/app/providers.tsx` or `src/app/_layout.tsx` | Migrations run on app launch; splash screen blocks until complete |
| 2e. Health check | `src/services/dbHealthCheck.ts` | Query returns `{ ok: true, version: N }` on dev screen |

---

## 3. Sub-tasks

### 3.1 Task 2a: Add Dependencies

```bash
npx expo install expo-sqlite
npm install drizzle-orm
npm install -D drizzle-kit
```

**Version pinning:** Pin exact versions in `package.json`. The `expo-sqlite` version must match the Expo SDK version. Check compatibility matrix before installing.

**Drizzle Kit config** (`drizzle.config.ts` at project root):

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
```

**Verify:**

- `npx drizzle-kit generate` produces a migration file
- `npx drizzle-kit check` passes (validates schema consistency)
- `npx tsc --noEmit` passes with the new types

---

### 3.2 Task 2b: Database Connection Singleton

Create `src/db/connection.ts`:

```typescript
import { openSync, type Database } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb(): ReturnType<typeof drizzle> {
  if (!dbInstance) {
    const sqlite: Database = openSync('shecare.db');
    dbInstance = drizzle(sqlite);
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    // expo-sqlite openSync does not expose a close() on the drizzle wrapper
    // In practice, we never close — the connection lives for the app lifetime
    dbInstance = null;
  }
}
```

**Rules:**

- Singleton pattern — one database connection for the entire app lifetime.
- NEVER close/reopen in production. Only close on testing teardown.
- The database file is `shecare.db` — stored in the app's document directory by `expo-sqlite`.

**Web fallback:** On web, `expo-sqlite` does not work. Detect platform and use `localStorage`-backed SQLite via `sql.js` if needed. Otherwise, warn and skip.

---

### 3.3 Task 2c: Copy Schema from Plan 1

Copy the complete `src/db/schema.ts` from Plan 1. Generate the initial migration:

```bash
npx drizzle-kit generate --name=add_tables_v1
```

Verify the migration SQL is correct:

```sql
CREATE TABLE IF NOT EXISTS cycle_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period_start_date TEXT NOT NULL,
  period_end_date TEXT,
  flow_intensity TEXT,
  symptoms TEXT,  -- JSON string
  mood_tags TEXT, -- JSON string
  energy_level INTEGER,
  notes TEXT,
  is_correction INTEGER DEFAULT 0,  -- boolean
  corrected_prediction_id TEXT,
  synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  deleted_at TEXT
);

CREATE INDEX idx_cycle_entries_user_id ON cycle_entries(user_id);
CREATE INDEX idx_cycle_entries_period_start ON cycle_entries(period_start_date);
CREATE INDEX idx_cycle_entries_synced_at ON cycle_entries(synced_at);
```

Check every table, index, and constraint. Repeat for all entity tables.

---

### 3.4 Task 2d: Wire Migrations Into App Startup

Migrations must run **before** the app UI renders. The splash screen blocks while migrations run.

**Option A (Recommended):** Run in the app's root layout file.

```typescript
// src/app/_layout.tsx (Expo Router)
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../db/migrations/migrations';
import { getDb } from '../db/connection';

function RootLayout() {
  const { success, error } = useMigrations(getDb(), migrations);

  if (error) {
    // Log to Sentry, show non-blocking toast, continue without SQLite
    logger.error('SQLite migration failed', error);
    captureException(error);
    // Do NOT block app — fall back to React Query cache
  }

  if (!success && !error) {
    // Show splash screen with "Preparing local storage..."
    return <SplashScreen />;
  }

  return <Stack />;
}
```

**Option B (Legacy):** Run manually in a `useEffect`:

```typescript
useEffect(() => {
  migrateDb(getDb(), migrations)
    .then(() => setReady(true))
    .catch((err) => {
      logger.error('Migration failed', err);
      setReady(true); // Continue without SQLite
    });
}, []);
```

**Prefer Option A** — it's the Drizzle Expo pattern and handles the splash screen lifecycle correctly.

**Loading state:** During migration, show a non-interactive splash screen with a subtle loading indicator. The text: *"Preparing your data..."*.

**Error state:** If migration fails (corrupt database, disk full):

1. Log full error to Sentry with `request_id` and `user_id`.
2. Show a toast: *"Local storage unavailable — some features may not work offline."*
3. Continue app without SQLite. The React Query cache (AsyncStorage) handles reads.
4. Do NOT retry migration automatically — a future app launch may succeed.

---

### 3.5 Task 2e: Remove persistQueryClient (React Query AsyncStorage Persist)

This is a critical architectural decision. With SQLite as the permanent offline cache, `persistQueryClient` becomes redundant and actively harmful.

**The bug it introduces:**

```
App launch → persistQueryClient hydrates RQ cache from AsyncStorage (data up to 7 days old)
  → React Query serves this data immediately (staleTime: 5 min means "fresh enough")
  → queryFn is NEVER called → SQLite read-through is BYPASSED
  → User sees potentially stale data from 7 days ago
  → SQLite has fresh data but it's never consulted
```

**Fix:** Remove `persistQueryClient` entirely. React Query becomes a pure in-memory cache + data-fetching orchestrator. SQLite handles all permanent offline storage.

**Implementation:**

```diff
// src/app/providers.tsx — BEFORE (Phase 1)
- import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
- import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
- import AsyncStorage from '@react-native-async-storage/async-storage';

- const asyncStoragePersister = createAsyncStoragePersister({
-   storage: AsyncStorage,
-   key: 'REACT_QUERY_OFFLINE_CACHE',
-   throttleTime: 1000,
- });

- <PersistQueryClientProvider
-   client={queryClient}
-   persistOptions={{
-     persister: asyncStoragePersister,
-     maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
-     buster: 'v1',
-   }}
- >
-   {children}
- </PersistQueryClientProvider>

// AFTER (Phase 2)
+ import { QueryClientProvider } from '@tanstack/react-query';

+ <QueryClientProvider client={queryClient}>
+   {children}
+ </QueryClientProvider>
```

**Remove the now-unnecessary dependency:**

```bash
npm uninstall @tanstack/react-query-persist-client @tanstack/query-async-storage-persister
```

**Clean up** the now-obsolete AsyncStorage key on first launch after upgrade:

```typescript
// Run once after migration
await AsyncStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
```

**What about the off chance that SQLite fails?** The migration error handler (Task 2d) already handles this — if SQLite fails, the app continues with a toast. In that degraded mode, React Query's in-memory cache still serves the current session's data. Both SQLite and `persistQueryClient` failing simultaneously (corrupt file AND corrupt AsyncStorage) is vanishingly unlikely.

---

### 3.6 Task 2f: Health Check Service

Create `src/services/dbHealthCheck.ts`:

```typescript
import { getDb } from '../db/connection';
import { sql } from 'drizzle-orm';

export interface DbHealth {
  ok: boolean;
  version: number;
  message?: string;
}

export async function checkDbHealth(): Promise<DbHealth> {
  try {
    const db = getDb();
    const result = await db.run(sql`SELECT 1 AS ok`);
    const tables = await db.all(sql`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `);
    return {
      ok: true,
      version: 1,
      message: `Tables: ${(tables as any[]).map((t: any) => t.name).join(', ')}`,
    };
  } catch (error) {
    logger.error('DB health check failed', error);
    return { ok: false, version: 0, message: String(error) };
  }
}
```

This is used on a hidden dev screen or in E2E tests to confirm the database is operational.

---

## 4. Testing

| Test | Method | What to Verify |
|------|--------|----------------|
| DB opens | Unit test | `getDb()` returns a drizzle instance, not null |
| Migration runs | E2E test | Install app → launch → verify tables exist in `sqlite_master` |
| Migration failure | Unit test with mock | App does not crash; falls back gracefully |
| Multiple launches | Manual test | Kill app → relaunch → migration does not re-run (uses `__drizzle_migrations` tracking table) |
| Health check | Dev screen | Returns `{ ok: true, version: 1 }` with table list |
| No `persistQueryClient` | Unit test | `QueryClientProvider` is used, NOT `PersistQueryClientProvider` |
| No RQ persist dependency | E2E test | `@tanstack/react-query-persist-client` is NOT in `package.json` |
| RQ cache does not survive kill | Manual test | Load data → force-kill app → relaunch → React Query refetches (no instant-hydrate from AsyncStorage) |

---

## 5. Rollback

1. Remove `expo-sqlite`, `drizzle-orm`, `drizzle-kit` from `package.json`.
2. Delete `src/db/` directory.
3. Remove migration call from `_layout.tsx`.
4. Increment React Query buster to `'v2'` (because the old apps may have partial SQLite state).

---

## 6. Success Criteria

- [ ] `expo-sqlite` + `drizzle-orm` installed and compile
- [ ] `src/db/connection.ts` exports working `getDb()` singleton
- [ ] `src/db/schema.ts` compiles and generates valid migration
- [ ] Migration runs on app launch without blocking more than 500ms on fresh install
- [ ] App launches without SQLite without crashing (migration failure path)
- [ ] `dbHealthCheck.ts` returns `{ ok: true }` on dev screen
- [ ] All tests pass (unit + E2E)
