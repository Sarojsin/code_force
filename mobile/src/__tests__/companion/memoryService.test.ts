// memoryService.test.ts — MemoryService unit/integration (in-memory sqlite + AES test double)

const encryptedStore: Record<string, string> = {};

jest.mock('src/services/storage', () => ({
  EncryptedStorage: {
    getItem: jest.fn(async (key: string) => encryptedStore[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      encryptedStore[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete encryptedStore[key];
    }),
    clear: jest.fn(async () => {
      Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]);
    }),
  },
}));

import { sql, eq } from 'drizzle-orm';
import { getDb } from '../../db/connection';
import { companionMemory, companionMetadata } from '../../db/schema';
import { memoryService } from '../../services/companion/memoryService';
import { memoryCrypto } from '../../services/companion/memoryCrypto';
import { companionLocalService } from '../../services/localDb';
import { useCompanionStore } from '../../stores/companionStore';

const USER = 'mem-user';

async function cleanup() {
  const db = getDb();
  await db.delete(companionMemory).where(sql`1 = 1`);
  await db.delete(companionMetadata).where(eq(companionMetadata.user_id, USER));
}

const daysAgo = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d;
};

describe('MemoryService (companion_memory)', () => {
  beforeEach(async () => {
    await cleanup();
    Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('recordHabit / getHabitAverage', () => {
    it('averages measured values across the rolling window', async () => {
      await memoryService.recordHabit(USER, 'sleep', 7, daysAgo(2));
      await memoryService.recordHabit(USER, 'sleep', 8, daysAgo(1));
      await memoryService.recordHabit(USER, 'sleep', 9, daysAgo(0));

      const avg = await memoryService.getHabitAverage(USER, 'sleep');
      expect(avg).toBeCloseTo(8);
    });

    it('returns undefined when no samples exist', async () => {
      expect(await memoryService.getHabitAverage(USER, 'sleep')).toBeUndefined();
    });

    it('dedupes same-day logs (last write wins — no double counting)', async () => {
      await memoryService.recordHabit(USER, 'sleep', 7, daysAgo(0));
      await memoryService.recordHabit(USER, 'sleep', 9, daysAgo(0));

      const db = getDb();
      const rows = await db
        .select()
        .from(companionMemory)
        .where(sql`${companionMemory.key} LIKE 'habit.sleep.%'`);
      expect(rows.length).toBe(1);
      expect(await memoryService.getHabitAverage(USER, 'sleep')).toBe(9);
    });
  });

  describe('encrypted value round-trip', () => {
    it('stores ciphertext (not plaintext) but decrypts in the service layer', async () => {
      await memoryService.recordHabit(USER, 'water', 8, daysAgo(0));

      const db = getDb();
      const today = daysAgo(0).toISOString().slice(0, 10);
      const rows = await db
        .select()
        .from(companionMemory)
        .where(eq(companionMemory.key, `habit.water.${today}`));

      const stored = rows[0]?.value;
      expect(stored).toBeTruthy();
      expect(stored).not.toContain('"value"');
      expect(stored).not.toBe(JSON.stringify({ value: 8 }));

      const decrypted = await memoryCrypto.decrypt(USER, stored);
      expect(decrypted).toBe(JSON.stringify({ value: 8 }));
      expect(await memoryService.getHabitAverage(USER, 'water')).toBe(8);
    });
  });

  describe('pruning — 60-day TTL + 1000-row cap, aggregates kept', () => {
    it('removes habit rows older than 60 days', async () => {
      const db = getDb();
      const oldValue = await memoryCrypto.encrypt(USER, JSON.stringify({ value: 1 }));
      const oldDate = Date.now() - 70 * 24 * 60 * 60 * 1000;
      await db
        .insert(companionMemory)
        .values({ key: 'habit.sleep.2024-01-01', value: oldValue, created_at: oldDate, updated_at: oldDate });

      const removed = await memoryService.prune();
      expect(removed).toBe(1);

      const rows = await db.select().from(companionMemory);
      expect(rows.map((r) => r.key)).not.toContain('habit.sleep.2024-01-01');
    });

    it('keeps aggregate rows even when old (recomputed state, not raw events)', async () => {
      const db = getDb();
      const oldValue = await memoryCrypto.encrypt(USER, JSON.stringify(['happy']));
      const oldDate = Date.now() - 70 * 24 * 60 * 60 * 1000;
      await db
        .insert(companionMemory)
        .values({ key: 'mood.history', value: oldValue, created_at: oldDate, updated_at: oldDate });

      await memoryService.prune();
      const rows = await db.select().from(companionMemory);
      expect(rows.map((r) => r.key)).toContain('mood.history');
    });

    it('caps total rows at 1000, deleting oldest raw rows (LRU by created_at)', async () => {
      const db = getDb();
      const value = await memoryCrypto.encrypt(USER, JSON.stringify({ value: 1 }));
      const base = Date.now() - 55 * 24 * 60 * 60 * 1000;
      for (let i = 0; i < 1001; i++) {
        const created = base + i * 1000;
        await db.insert(companionMemory).values({
          key: `habit.raw.${i}`,
          value,
          created_at: created,
          updated_at: created,
        });
      }

      await memoryService.prune();

      const total = await db.select({ c: sql<number>`count(*)` }).from(companionMemory);
      expect(Number(total[0]?.c)).toBe(1000);

      const rows = await db.select().from(companionMemory);
      const keys = rows.map((r) => r.key);
      expect(keys).not.toContain('habit.raw.0');
      expect(keys).toContain('habit.raw.1000');
    });
  });

  describe('getContextSnapshot', () => {
    it('builds habit averages, frequent types, streaks and sleep hour', async () => {
      await memoryService.recordHabit(USER, 'sleep', 7, daysAgo(2));
      await memoryService.recordHabit(USER, 'sleep', 8, daysAgo(1));
      await memoryService.recordHabit(USER, 'sleep', 9, daysAgo(0));
      await memoryService.recordHabit(USER, 'water', 8, daysAgo(0));

      const snap = await memoryService.getContextSnapshot(USER);
      expect(snap.habitAverages.sleep).toBeCloseTo(8);
      expect(snap.habitAverages.water).toBe(8);
      expect(snap.frequentLogTypes).toContain('sleep');
      expect(snap.frequentLogTypes).not.toContain('water');
      expect(snap.streaks.sleep).toBeGreaterThanOrEqual(1);
      expect(typeof snap.sleepAverageHour).toBe('number');
    });

    it('tracks pet frequency and mood history/trend', async () => {
      await memoryService.recordMood(USER, 'sad');
      await memoryService.recordMood(USER, 'neutral');
      await memoryService.recordMood(USER, 'happy');
      await memoryService.recordPet(USER);
      await memoryService.recordPet(USER);

      const snap = await memoryService.getContextSnapshot(USER);
      expect(snap.petCount).toBe(2);
      expect(snap.moodHistory).toEqual(['sad', 'neutral', 'happy']);
      expect(snap.moodTrend).toBe('improving');
    });

    it('exposes cycle state and relationship level', async () => {
      const pastDate = daysAgo(20).toISOString().slice(0, 10);
      await memoryService.recordPeriod(USER, pastDate);
      await memoryService.recordPeriodPrediction(USER, 3);

      await companionLocalService.addXP(USER, 100);

      const snap = await memoryService.getContextSnapshot(USER);
      expect(snap.lastPeriodDate).toBe(pastDate);
      expect(snap.daysSinceLastPeriod).toBeGreaterThan(10);
      expect(snap.daysUntilNextPeriod).not.toBeNull();
      expect(snap.relationshipLevel).toBe(2);
    });
  });

  describe('hydrateMemory', () => {
    it('restores mood history + lastSeen into the store', async () => {
      await memoryService.recordMood(USER, 'happy');
      await memoryService.recordMood(USER, 'neutral');

      useCompanionStore.setState({ userId: USER });

      await memoryService.hydrateMemory(USER);

      const state = useCompanionStore.getState();
      expect(state.memory.moodHistory).toEqual(['happy', 'neutral']);
      expect(state.lastSeenAt).not.toBeNull();

      useCompanionStore.setState({ userId: null });
    });
  });
});
