import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection';
import { companionMetadata } from '../../db/schema';
import type { CompanionMetadata, NewCompanionMetadata } from '../../db/schema';
import { logger } from '../../utils';
import * as Sentry from '@sentry/react-native';

export function calculateLevel(xp: number): number {
  if (xp >= 100000) return 50;
  if (xp >= 10000) return 20;
  if (xp >= 2000) return 10;
  if (xp >= 500) return 5;
  return 1;
}

export const RELATIONSHIP_THRESHOLDS = [100, 500, 2000, 10000, 50000];

export function calculateRelationshipLevel(xp: number): number {
  let level = 1;
  for (const threshold of RELATIONSHIP_THRESHOLDS) {
    if (xp >= threshold) level += 1;
  }
  return level;
}

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
      const newLevel = calculateLevel(newXp);
      const newRelationshipLevel = calculateRelationshipLevel(newXp);
      await db
        .insert(companionMetadata)
        .values({
          user_id: userId,
          xp: newXp,
          level: newLevel,
          relationship_level: newRelationshipLevel,
          updated_at: new Date().toISOString(),
        } as NewCompanionMetadata)
        .onConflictDoUpdate({
          target: companionMetadata.user_id,
          set: {
            xp: newXp,
            level: newLevel,
            relationship_level: newRelationshipLevel,
            updated_at: new Date().toISOString(),
          },
        });
    } catch (error) {
      this.handleError('addXP', error);
    }
  }

  async updateLastSeen(userId: string): Promise<void> {
    try {
      const db = getDb();
      await db
        .update(companionMetadata)
        .set({
          last_seen_at: Date.now(),
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .where(eq(companionMetadata.user_id, userId));
    } catch (error) {
      this.handleError('updateLastSeen', error);
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

  private handleError(method: string, error: unknown): void {
    logger.error(`CompanionLocalService.${method} failed`, error);
    Sentry.captureException(error, {
      tags: { service: 'CompanionLocalService', method },
    });
  }
}

export const companionLocalService = new CompanionLocalService();
