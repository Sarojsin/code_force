# Storage Plan 3: Service Layer (Repository Pattern)

**Priority:** High (2 days)
**Dependencies:** Plan 1 (schema), Plan 2 (DB connection + migrations)
**Phase:** Phase 2 (SQLite Integration)

---

## 1. Objective

Create the `src/services/localDb/` repository layer that encapsulates all SQLite access behind typed, tested service classes. Screens and sync engine must never import `db` directly — they call `localDb.cycle.getHistory()` or `localDb.journal.upsert()`.

---

## 2. Deliverables

| Deliverable | Output | Acceptance Criteria |
|-------------|--------|---------------------|
| 3a. Base service class | `src/services/localDb/BaseLocalService.ts` | Common CRUD, upsert, error wrapper, pagination |
| 3b. Entity services | `src/services/localDb/{Cycle,Journal,Mood,etc.}LocalService.ts` | Each entity gets typed read/upsert/delete methods |
| 3c. Singleton index | `src/services/localDb/index.ts` | Exports `localDb.cycle`, `localDb.journal`, etc. as singletons |
| 3d. Unit tests | `src/services/localDb/__tests__/` | All CRUD paths tested with in-memory SQLite |

---

## 3. Sub-tasks

### 3.1 Task 3a: Base Service Class

Every service follows the same pattern. Create an abstract base:

```typescript
// src/services/localDb/BaseLocalService.ts
import { getDb } from '../../db/connection';
import { logger } from '../../utils/logger';
import * as Sentry from '@sentry/react-native';

export abstract class BaseLocalService<T extends { id: string }> {
  // Drizzle table object — must be set by subclass (e.g. `cycleEntries` from schema)
  protected abstract table: any;
  protected abstract tableName: string;

  /**
   * Upsert a single record. INSERT if not exists, UPDATE if exists.
   * Uses the primary key (`id`) as the conflict target.
   */
  async upsert(record: T): Promise<void> {
    try {
      const db = getDb();
      // Drizzle's onConflictDoUpdate logic
      await db
        .insert(this.table)
        .values({ ...record, synced_at: new Date().toISOString() })
        .onConflictDoUpdate({
          target: this.table.id,
          set: { ...record, synced_at: new Date().toISOString() },
        });
    } catch (error) {
      this.handleError('upsert', error);
    }
  }

  /**
   * Upsert multiple records in a transaction.
   */
  async upsertMany(records: T[]): Promise<void> {
    if (records.length === 0) return;
    try {
      const db = getDb();
      await db.transaction(async (tx) => {
        for (const record of records) {
          await tx
            .insert(this.table)
            .values({ ...record, synced_at: new Date().toISOString() })
            .onConflictDoUpdate({
              target: this.table.id,
              set: { ...record, synced_at: new Date().toISOString() },
            });
        }
      });
    } catch (error) {
      this.handleError('upsertMany', error);
    }
  }

  /**
   * Get all records for a user, newest first.
   */
  async getAllByUser(
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<T[]> {
    try {
      const db = getDb();
      // Subclass implements the specific query with correct order
      return [];
    } catch (error) {
      this.handleError('getAllByUser', error);
      return [];
    }
  }

  /**
   * Get a single record by ID.
   */
  async getById(id: string): Promise<T | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.id, id))
        .limit(1);
      return result[0] ?? null;
    } catch (error) {
      this.handleError('getById', error);
      return null;
    }
  }

  /**
   * Soft-delete a record.
   */
  async softDelete(id: string): Promise<void> {
    try {
      const db = getDb();
      await db
        .update(this.table)
        .set({
          is_active: false,
          deleted_at: new Date().toISOString(),
        })
        .where(eq(this.table.id, id));
    } catch (error) {
      this.handleError('softDelete', error);
    }
  }

  /**
   * Hard-delete a record (only for tests and admin).
   */
  async hardDelete(id: string): Promise<void> {
    try {
      const db = getDb();
      await db.delete(this.table).where(eq(this.table.id, id));
    } catch (error) {
      this.handleError('hardDelete', error);
    }
  }

  /**
   * Get records synced before a given timestamp (for sync engine pruning).
   */
  async getSyncedBefore(timestamp: string): Promise<T[]> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(lt(this.table.synced_at, timestamp));
      return result;
    } catch (error) {
      this.handleError('getSyncedBefore', error);
      return [];
    }
  }

  private handleError(method: string, error: unknown): void {
    logger.error(`BaseLocalService.${method} failed`, { table: this.tableName, error });
    Sentry.captureException(error, {
      tags: { service: 'BaseLocalService', method, table: this.tableName },
    });
    // Do NOT rethrow — the service layer swallows errors and returns null/[].
    // Callers must check for empty results and fall back to React Query cache.
  }
}
```

**Key design decisions:**

- **No rethrow:** All errors are logged to Sentry and swallowed. The caller gets `null` or `[]` and must fall back.
- **`synced_at` is managed by the service layer**, not the server. It tracks when the record was last written to SQLite.
- **`upsertMany` uses a transaction** for atomicity. If one record fails, the entire batch rolls back.
- **Soft delete** is the default. Hard delete is only for tests.

---

### 3.2 Task 3b: Entity-Specific Services

Each entity service extends `BaseLocalService` and adds domain-specific methods.

```typescript
// src/services/localDb/CycleLocalService.ts
import { BaseLocalService } from './BaseLocalService';
import { cycleEntries } from '../../db/schema';
import type { CycleEntry } from '../../db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

export class CycleLocalService extends BaseLocalService<CycleEntry> {
  protected table = cycleEntries;
  protected tableName = 'cycle_entries';

  async getHistory(
    userId: string,
    options?: { limit?: number; offset?: number; months?: number }
  ): Promise<CycleEntry[]> {
    try {
      const db = getDb();
      const conditions = [eq(cycleEntries.user_id, userId), eq(cycleEntries.is_active, true)];
      if (options?.months) {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - options.months);
        conditions.push(gte(cycleEntries.period_start_date, cutoff.toISOString().split('T')[0]));
      }
      return db
        .select()
        .from(cycleEntries)
        .where(and(...conditions))
        .orderBy(desc(cycleEntries.period_start_date))
        .limit(options?.limit ?? 50)
        .offset(options?.offset ?? 0);
    } catch (error) {
      this.handleError('getHistory', error);
      return [];
    }
  }

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<CycleEntry[]> {
    try {
      const db = getDb();
      return db
        .select()
        .from(cycleEntries)
        .where(
          and(
            eq(cycleEntries.user_id, userId),
            eq(cycleEntries.is_active, true),
            gte(cycleEntries.period_start_date, startDate),
            // period_end_date may be null (active period)
            sql`(${cycleEntries.period_end_date} IS NULL OR ${cycleEntries.period_end_date} <= ${endDate})`
          )
        )
        .orderBy(desc(cycleEntries.period_start_date));
    } catch (error) {
      this.handleError('getByDateRange', error);
      return [];
    }
  }

  async getLatest(userId: string): Promise<CycleEntry | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(cycleEntries)
        .where(and(eq(cycleEntries.user_id, userId), eq(cycleEntries.is_active, true)))
        .orderBy(desc(cycleEntries.period_start_date))
        .limit(1);
      return result[0] ?? null;
    } catch (error) {
      this.handleError('getLatest', error);
      return null;
    }
  }
}
```

**Repeat for each entity.** Each service gets domain methods based on actual query patterns from the TanStack Query hooks:

| Service | Domain Methods |
|---------|---------------|
| `CycleLocalService` | `getHistory()`, `getByDateRange()`, `getLatest()` |
| `JournalLocalService` | `getByDate()`, `getRecent()`, `getByMoodTags()` |
| `MoodLocalService` | `getByDateRange()`, `getAverageByMonth()` |
| `SymptomLocalService` | `getByCycleId()`, `getCommonByUser()` |
| `PregnancyLocalService` | `getTimeline()`, `getMilestone()` |
| `HealthInsightLocalService` | `getByUser()`, `getByCategory()` |
| `FamilyLocalService` | `getByUser()`, `getByRelation()` |
| `NotificationLocalService` | `getUnread()`, `getByUser()`, `markRead()` |
| `FeatureFlagLocalService` | `getAll()`, `getByKey()` |

---

### 3.3 Task 3c: Singleton Index

```typescript
// src/services/localDb/index.ts
import { CycleLocalService } from './CycleLocalService';
import { JournalLocalService } from './JournalLocalService';
import { MoodLocalService } from './MoodLocalService';
import { SymptomLocalService } from './SymptomLocalService';
import { PregnancyLocalService } from './PregnancyLocalService';
import { HealthInsightLocalService } from './HealthInsightLocalService';
import { FamilyLocalService } from './FamilyLocalService';
import { NotificationLocalService } from './NotificationLocalService';
import { FeatureFlagLocalService } from './FeatureFlagLocalService';

export const localDb = {
  cycle: new CycleLocalService(),
  journal: new JournalLocalService(),
  mood: new MoodLocalService(),
  symptom: new SymptomLocalService(),
  pregnancy: new PregnancyLocalService(),
  insight: new HealthInsightLocalService(),
  family: new FamilyLocalService(),
  notification: new NotificationLocalService(),
  featureFlag: new FeatureFlagLocalService(),
} as const;

export type LocalDb = typeof localDb;
```

This is the only import that screens and sync engine use:

```typescript
import { localDb } from '../services/localDb';
await localDb.cycle.getHistory(userId);
```

---

### 3.4 Task 3d: Unit Tests

Use `better-sqlite3` with `drizzle-orm/better-sqlite3` driver for test speed + in-memory database.

```typescript
// src/services/localDb/__tests__/CycleLocalService.test.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../../db/schema';
import { CycleLocalService } from '../CycleLocalService';

// Mock getDb to return the test database
jest.mock('../../../db/connection', () => ({
  getDb: jest.fn(),
}));

describe('CycleLocalService', () => {
  let service: CycleLocalService;
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    // Run migration: create tables
    (getDb as jest.Mock).mockReturnValue(db);
    service = new CycleLocalService();
  });

  afterEach(() => {
    sqlite.close();
    jest.clearAllMocks();
  });

  it('upserts a cycle entry', async () => {
    await service.upsert(mockCycleEntry());
    const result = await service.getById(mockCycleEntry().id);
    expect(result).toMatchObject(mockCycleEntry());
  });

  it('upserts many records in a transaction', async () => {
    const entries = [mockCycleEntry(), mockCycleEntry2()];
    await service.upsertMany(entries);
    const history = await service.getHistory('user-1');
    expect(history).toHaveLength(2);
  });

  it('returns empty array when no records', async () => {
    const history = await service.getHistory('non-existent');
    expect(history).toEqual([]);
  });

  it('soft-deletes a record', async () => {
    await service.upsert(mockCycleEntry());
    await service.softDelete(mockCycleEntry().id);
    const result = await service.getById(mockCycleEntry().id);
    expect(result?.is_active).toBe(false);
    expect(result?.deleted_at).toBeTruthy();
  });

  it('filters by date range', async () => {
    await service.upsert(mockCycleEntry()); // period_start_date: '2026-01-15'
    await service.upsert(mockCycleEntry2()); // period_start_date: '2026-06-20'
    const range = await service.getByDateRange('user-1', '2026-01-01', '2026-03-01');
    expect(range).toHaveLength(1);
  });

  it('gets latest entry', async () => {
    await service.upsert(mockCycleEntry()); // older
    await service.upsert(mockCycleEntry2()); // newer
    const latest = await service.getLatest('user-1');
    expect(latest?.id).toBe(mockCycleEntry2().id);
  });
});
```

**Coverage target:** 90%+ on all service methods, including error paths (simulate DB failure → verify `[]` returned, Sentry called).

---

## 4. Gradients & Error Handling

| Scenario | Behavior |
|----------|----------|
| SQLite file is corrupt | `getDb()` throws → all methods return `[]`/`null` → Sentry logged |
| Disk full during upsertMany | Transaction rolls back → Sentry logged → caller gets no error (graceful) |
| Invalid data (wrong type) | Drizzle throws on insert → caught by try-catch → Sentry logged |
| Schema mismatch (missing column) | SQLite ignores extra columns → missing columns return `undefined` → service handles gracefully |

---

## 5. Success Criteria

- [ ] `BaseLocalService` implements: `upsert`, `upsertMany`, `getAllByUser`, `getById`, `softDelete`, `hardDelete`, `getSyncedBefore`
- [ ] Every entity service has domain-specific methods matching actual query hook patterns
- [ ] `localDb` singleton index exports all services
- [ ] All services use `getDb()` — no direct imports of `expo-sqlite`
- [ ] All DB errors are caught, logged to Sentry, swallowed — `[]` or `null` returned
- [ ] Unit tests pass for all 9 services (in-memory SQLite)
- [ ] Coverage ≥ 90% on `src/services/localDb/`
- [ ] Screens do NOT import `db` directly (enforced by lint rule)
