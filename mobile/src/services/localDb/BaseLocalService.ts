import { eq, lt } from 'drizzle-orm';
import { getDb } from '../../db/connection';
import { logger } from '../../utils';
import * as Sentry from '@sentry/react-native';

export abstract class BaseLocalService<T extends { id: string }> {
  protected abstract table: any;
  protected abstract tableName: string;
  protected idColumn: any = null;

  async upsert(record: T): Promise<void> {
    try {
      const db = getDb();
      const target = this.idColumn ?? this.table.id;
      await db
        .insert(this.table)
        .values({ ...record, synced_at: new Date().toISOString() })
        .onConflictDoUpdate({
          target,
          set: { ...record, synced_at: new Date().toISOString() },
        });
    } catch (error) {
      this.handleError('upsert', error);
    }
  }

  async upsertMany(records: T[]): Promise<void> {
    if (records.length === 0) return;
    try {
      const db = getDb();
      for (const record of records) {
        await db
          .insert(this.table)
          .values({ ...record, synced_at: new Date().toISOString() })
          .onConflictDoUpdate({
            target: this.table.id,
            set: { ...record, synced_at: new Date().toISOString() },
          });
      }
    } catch (error) {
      this.handleError('upsertMany', error);
    }
  }

  async getById(id: string): Promise<T | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.id, id))
        .limit(1);
      return (result as T[])[0] ?? null;
    } catch (error) {
      this.handleError('getById', error);
      return null;
    }
  }

  async getAllByUser(userId: string, options?: { limit?: number; offset?: number }): Promise<T[]> {
    try {
      const db = getDb();
      const query = db.select().from(this.table).where(eq(this.table.user_id, userId));
      if (options?.limit) query.limit(options.limit);
      if (options?.offset) query.offset(options.offset);
      return (await query) as T[];
    } catch (error) {
      this.handleError('getAllByUser', error);
      return [];
    }
  }

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

  async hardDelete(id: string): Promise<void> {
    try {
      const db = getDb();
      await db.delete(this.table).where(eq(this.table.id, id));
    } catch (error) {
      this.handleError('hardDelete', error);
    }
  }

  async getSyncedBefore(timestamp: string): Promise<T[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(this.table)
        .where(lt(this.table.synced_at, timestamp))) as T[];
    } catch (error) {
      this.handleError('getSyncedBefore', error);
      return [];
    }
  }

  protected handleError(method: string, error: unknown): void {
    logger.error(`${this.tableName}.${method} failed`, error);
    Sentry.captureException(error, {
      tags: { service: 'BaseLocalService', method, table: this.tableName },
    });
  }
}
