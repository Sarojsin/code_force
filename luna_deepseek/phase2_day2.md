# Phase 2 Day 2 — Health Hub: Schema + Migration + Service

## Goal
Create the `health_metrics` SQLite table, generate a Drizzle migration, and build `HealthMetricsLocalService` with full CRUD, streak tracking, and today's metrics query.

---

## 2.1 Add `health_metrics` Table to `src/db/schema.ts`

Append after the `companionMetadata` table:

```typescript
// ---------------------------------------------------------------------------
// 21. Health Metrics (Luna Health Hub — purely local, no sync)
// ---------------------------------------------------------------------------
export const healthMetrics = sqliteTable('health_metrics', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  metric_type: text('metric_type', {
    enum: ['sleep', 'water', 'food', 'exercise', 'medication'],
  }).notNull(),
  value: text('value').notNull(),            // JSON payload
  logged_at: text('logged_at').notNull(),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type HealthMetric = typeof healthMetrics.$inferSelect;
export type NewHealthMetric = typeof healthMetrics.$inferInsert;
```

**Why `value` is a JSON string** — Each metric type stores different data (sleep: `{hours, quality}`, water: `{amount}`, food: `{mealType, notes}`, etc.). A single JSON `value` column avoids 5 separate typed columns. The service layer handles serialization/deserialization.

---

## 2.2 Generate Drizzle Migration

```bash
cd mobile
npx drizzle-kit generate --name add_health_metrics
```

This creates `mobile/drizzle/0003_add_health_metrics.sql`. Verify its contents:

```sql
CREATE TABLE IF NOT EXISTS health_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK(metric_type IN ('sleep','water','food','exercise','medication')),
  value TEXT NOT NULL,
  logged_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_health_metrics_user_id ON health_metrics(user_id);
CREATE INDEX idx_health_metrics_logged_at ON health_metrics(logged_at);
```

Run the migration:

```bash
npx expo run:ios    # or :android — drizzle applies pending migrations on DB open
```

---

## 2.3 Create `src/utils/uuid.ts` (Fix 3 from review)

React Native (Hermes) does not expose `crypto.randomUUID()`. Create a shared utility:

```typescript
/**
 * UUID generator — wraps expo-crypto for Hermes compatibility.
 * Expo SDK 57+ ships expo-crypto built-in.
 */
import { randomUUID } from 'expo-crypto';

export function generateUUID(): string {
  return randomUUID();
}
```

**Note:** If `expo-crypto` isn't available, install it:
```bash
npx expo install expo-crypto
```

---

## 2.4 Create `HealthMetricsLocalService`

**File:** `src/services/localDb/HealthMetricsLocalService.ts`

```typescript
import { BaseLocalService } from './BaseLocalService';
import { healthMetrics } from '../../db/schema';
import { eventBus } from '../eventBus';
import { generateUUID } from '../../utils/uuid';
import { and, eq, desc, sql, gte } from 'drizzle-orm';
import type { HealthMetric, NewHealthMetric } from '../../db/schema';

type MetricType = 'sleep' | 'water' | 'food' | 'exercise' | 'medication';

export interface SleepValue {
  hours: number;
  quality?: 1 | 2 | 3 | 4 | 5;
}

export interface WaterValue {
  amount: number; // mL
}

export interface FoodValue {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  notes?: string;
}

export interface ExerciseValue {
  type: string;
  duration: number; // minutes
}

export interface MedicationValue {
  name: string;
  taken: boolean;
  dosage?: string;
}

export class HealthMetricsLocalService extends BaseLocalService<HealthMetric> {
  protected table = healthMetrics;
  protected tableName = 'health_metrics';

  async getToday(userId: string): Promise<HealthMetric[]> {
    const today = new Date().toISOString().split('T')[0];
    try {
      const db = await this.getDb();
      return await db
        .select()
        .from(healthMetrics)
        .where(
          and(
            eq(healthMetrics.user_id, userId),
            sql`date(${healthMetrics.logged_at}) = ${today}`
          )
        )
        .orderBy(desc(healthMetrics.logged_at));
    } catch (error) {
      this.handleError('getToday', error);
      return [];
    }
  }

  async getByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<HealthMetric[]> {
    try {
      const db = await this.getDb();
      return await db
        .select()
        .from(healthMetrics)
        .where(
          and(
            eq(healthMetrics.user_id, userId),
            gte(healthMetrics.logged_at, startDate),
            sql`${healthMetrics.logged_at} <= ${endDate}`
          )
        )
        .orderBy(desc(healthMetrics.logged_at));
    } catch (error) {
      this.handleError('getByDateRange', error);
      return [];
    }
  }

  async logMetric(
    userId: string,
    type: MetricType,
    value: SleepValue | WaterValue | FoodValue | ExerciseValue | MedicationValue
  ): Promise<void> {
    try {
      const db = await this.getDb();
      const entry: NewHealthMetric = {
        id: generateUUID(),
        user_id: userId,
        metric_type: type,
        value: JSON.stringify(value),
        logged_at: new Date().toISOString(),
      };
      await db.insert(healthMetrics).values(entry);

      // Emit event for Luna's EventEngine to react
      eventBus.emit(`${type}_logged` as any, {
        userId,
        ...value,
      } as any);
    } catch (error) {
      this.handleError('logMetric', error);
    }
  }

  async getStreak(userId: string, metricType: MetricType): Promise<number> {
    try {
      const db = await this.getDb();
      const rows = await db
        .select({ logged_at: healthMetrics.logged_at })
        .from(healthMetrics)
        .where(
          and(
            eq(healthMetrics.user_id, userId),
            eq(healthMetrics.metric_type, metricType)
          )
        )
        .orderBy(desc(healthMetrics.logged_at))
        .limit(365); // safety limit

      let streak = 0;
      let expected = new Date();
      expected.setHours(0, 0, 0, 0);

      for (const row of rows) {
        const rowDate = new Date(row.logged_at);
        rowDate.setHours(0, 0, 0, 0);
        const diffMs = expected.getTime() - rowDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Same day — skip (don't double-count)
          continue;
        } else if (diffDays === 1) {
          streak++;
          expected = rowDate;
        } else if (diffDays > 1) {
          break; // gap found
        }
      }

      return streak;
    } catch {
      return 0;
    }
  }

  async getTodayCompletion(userId: string): Promise<{
    logged: MetricType[];
    total: number;
  }> {
    const today = await this.getToday(userId);
    const logged = new Set(today.map((r) => r.metric_type as MetricType));
    return {
      logged: Array.from(logged),
      total: 5, // sleep, water, food, exercise, medication
    };
  }
}
```

---

## 2.5 Export from `src/services/localDb/index.ts`

```typescript
export { HealthMetricsLocalService } from './HealthMetricsLocalService';
```

Add an instance to the barrel:

```typescript
import { HealthMetricsLocalService } from './HealthMetricsLocalService';

export const healthMetricsLocalService = new HealthMetricsLocalService();
```

---

## 2.6 Validation

- [ ] `schema.ts` has `healthMetrics` table defined
- [ ] Migration file exists at `drizzle/0003_add_health_metrics.sql`
- [ ] `generateUUID()` works in test environment (mock if needed)
- [ ] `HealthMetricsLocalService.logMetric()` inserts a row and emits an event
- [ ] `HealthMetricsLocalService.getToday()` returns only today's entries
- [ ] `HealthMetricsLocalService.getStreak()` returns correct count (test with known dates)
- [ ] `HealthMetricsLocalService.getTodayCompletion()` shows X/5 metrics
- [ ] `tsc --noEmit` passes with 0 new errors
