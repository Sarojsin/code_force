# Day 1 — Database Schema + Migration + CompanionLocalService

## Goal
Create the SQLite `companion_metadata` table, generate the Drizzle migration, and build the `CompanionLocalService` that wraps all CRUD operations.

---

## 1.1 Add the Table to `src/db/schema.ts`

Append this table definition after the existing `syncLog` table (line ~418):

```typescript
// ---------------------------------------------------------------------------
// 20. Companion Metadata (Luna the cat — purely local, no sync)
// ---------------------------------------------------------------------------
export const companionMetadata = sqliteTable('companion_metadata', {
  user_id: text('user_id').primaryKey(),
  xp: integer('xp').notNull().default(0),
  coins: integer('coins').notNull().default(0),
  level: integer('level').notNull().default(1),
  current_outfit_id: text('current_outfit_id'),
  owned_outfits: text('owned_outfits', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  memory: text('memory', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
  is_hidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
  reduce_animations: integer('reduce_animations', { mode: 'boolean' }).notNull().default(false),
  mute_sounds: integer('mute_sounds', { mode: 'boolean' }).notNull().default(false),
  assets_version: text('assets_version'),              // "1.0.0" — tracks which asset bundle is installed
  install_status: text('install_status', { enum: ['none', 'downloading', 'extracting', 'ready', 'error'] }).notNull().default('none'),
  last_active_at: text('last_active_at'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export type CompanionMetadata = typeof companionMetadata.$inferSelect;
export type NewCompanionMetadata = typeof companionMetadata.$inferInsert;
```

**Why `user_id` as PK?** — Luna's data is per-user and 1:1. No need for a separate UUID. The schema matches the plan's SQL design.

---

## 1.2 Export from `src/db/schema.ts`

Add to the barrel export at the bottom of the file (or wherever exports are gathered — check if there is an `index.ts` for db):

```typescript
export { companionMetadata } from './schema';
export type { CompanionMetadata, NewCompanionMetadata } from './schema';
```

---

## 1.3 Generate the Drizzle Migration

Run the drizzle kit generate command (adjust path if needed):

```bash
cd mobile
npx drizzle-kit generate --name add_companion_metadata
```

This creates a new file under `src/db/migrations/` like `0002_add_companion_metadata.sql`.

**Verify the generated SQL** — it should look like:

```sql
CREATE TABLE companion_metadata (
  user_id TEXT PRIMARY KEY,
  xp INTEGER DEFAULT 0 NOT NULL,
  coins INTEGER DEFAULT 0 NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  current_outfit_id TEXT,
  owned_outfits TEXT DEFAULT '[]' NOT NULL,
  memory TEXT DEFAULT '{}' NOT NULL,
  is_hidden INTEGER DEFAULT 0 NOT NULL,
  reduce_animations INTEGER DEFAULT 0 NOT NULL,
  mute_sounds INTEGER DEFAULT 0 NOT NULL,
  assets_version TEXT,
  install_status TEXT DEFAULT 'none' NOT NULL CHECK(install_status IN ('none','downloading','extracting','ready','error')),
  last_active_at TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL
);
```

---

## 1.4 Build `CompanionLocalService.ts`

**File:** `src/services/localDb/CompanionLocalService.ts`

```typescript
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection';
import { companionMetadata } from '../../db/schema';
import type { CompanionMetadata, NewCompanionMetadata } from '../../db/schema';
import { logger } from '../../utils';
import * as Sentry from '@sentry/react-native';

export class CompanionLocalService {
  async getMetadata(userId: string): Promise<CompanionMetadata | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(companionMetadata)
        .where(eq(companionMetadata.user_id, userId))
        .limit(1);
      return (result as CompanionMetadata[])[0] ?? null;
    } catch (error) {
      this.handleError('getMetadata', error);
      return null;
    }
  }

  async upsertMetadata(data: NewCompanionMetadata): Promise<void> {
    try {
      const db = getDb();
      await db
        .insert(companionMetadata)
        .values({ ...data, updated_at: new Date().toISOString() })
        .onConflictDoUpdate({
          target: companionMetadata.user_id,
          set: { ...data, updated_at: new Date().toISOString() },
        });
    } catch (error) {
      this.handleError('upsertMetadata', error);
    }
  }

  async addXP(userId: string, amount: number): Promise<void> {
    try {
      const db = getDb();
      const current = await this.getMetadata(userId);
      const newXp = (current?.xp ?? 0) + amount;
      const newLevel = this.calculateLevel(newXp);
      await db
        .insert(companionMetadata)
        .values({
          user_id: userId,
          xp: newXp,
          level: newLevel,
          updated_at: new Date().toISOString(),
        } as NewCompanionMetadata)
        .onConflictDoUpdate({
          target: companionMetadata.user_id,
          set: { xp: newXp, level: newLevel, updated_at: new Date().toISOString() },
        });
    } catch (error) {
      this.handleError('addXP', error);
    }
  }

  async addCoins(userId: string, amount: number): Promise<void> {
    try {
      const db = getDb();
      const current = await this.getMetadata(userId);
      const newCoins = (current?.coins ?? 0) + amount;
      await db
        .update(companionMetadata)
        .set({ coins: newCoins, updated_at: new Date().toISOString() })
        .where(eq(companionMetadata.user_id, userId));
    } catch (error) {
      this.handleError('addCoins', error);
    }
  }

  async updateInstallStatus(userId: string, status: string, version?: string): Promise<void> {
    try {
      const db = getDb();
      const update: any = { install_status: status, updated_at: new Date().toISOString() };
      if (version) update.assets_version = version;
      await db
        .update(companionMetadata)
        .set(update)
        .where(eq(companionMetadata.user_id, userId));
    } catch (error) {
      this.handleError('updateInstallStatus', error);
    }
  }

  async getInstallStatus(userId: string): Promise<{ status: string; version: string | null } | null> {
    const meta = await this.getMetadata(userId);
    if (!meta) return null;
    return { status: meta.install_status, version: meta.assets_version };
  }

  async updateSetting(userId: string, key: 'is_hidden' | 'reduce_animations' | 'mute_sounds', value: boolean): Promise<void> {
    try {
      const db = getDb();
      await db
        .update(companionMetadata)
        .set({ [key]: value, updated_at: new Date().toISOString() })
        .where(eq(companionMetadata.user_id, userId));
    } catch (error) {
      this.handleError('updateSetting', error);
    }
  }

  private calculateLevel(xp: number): number {
    if (xp >= 100000) return 50;
    if (xp >= 10000) return 20;
    if (xp >= 2000) return 10;
    if (xp >= 500) return 5;
    return 1;
  }

  private handleError(method: string, error: unknown): void {
    logger.error(`CompanionLocalService.${method} failed`, error);
    Sentry.captureException(error, {
      tags: { service: 'CompanionLocalService', method },
    });
  }
}

export const companionLocalService = new CompanionLocalService();
```

---

## 1.5 Export from `src/services/localDb/index.ts`

Add to the barrel export:

```typescript
export { CompanionLocalService, companionLocalService } from './CompanionLocalService';
```

---

## 1.6 Integration Check

Ensure `App.tsx` MigrationGate picks up the new migration automatically (it reads from `migrations` object, which Drizzle generates). No code change needed there.

---

## ✅ Day 1 Validation

- [ ] `companion_metadata` table exists in `schema.ts` with all 13 columns
- [ ] Drizzle migration file generated under `src/db/migrations/`
- [ ] Migration SQL verified (matches schema)
- [ ] `CompanionLocalService.ts` created with all 5 methods
- [ ] `getMetadata(userId)` returns `null` or valid row
- [ ] `addXP(userId, 10)` increments XP correctly
- [ ] `addCoins(userId, 5)` increments coins correctly
- [ ] `updateInstallStatus(userId, 'ready', '1.0.0')` updates install_status and assets_version
- [ ] `getInstallStatus(userId)` returns `{ status: 'ready', version: '1.0.0' }`
- [ ] `updateSetting(userId, 'is_hidden', true)` updates row
- [ ] Service exported from `index.ts`
- [ ] App builds without TypeScript errors
