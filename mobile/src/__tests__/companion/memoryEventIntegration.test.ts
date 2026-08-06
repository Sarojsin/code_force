// memoryEventIntegration.test.ts — write-through bridge (rules §2.1): health/cycle
// events on the bus are recorded into companion_memory idempotently.

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

import { sql } from 'drizzle-orm';
import { getDb } from '../../db/connection';
import { companionMemory } from '../../db/schema';
import { initMemoryService, memoryService } from '../../services/companion/memoryService';
import { memoryCrypto } from '../../services/companion/memoryCrypto';
import { eventBus } from '../../services/eventBus';

const USER = 'mem-event-user';

async function cleanup() {
  const db = getDb();
  await db.delete(companionMemory).where(sql`1 = 1`);
  Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]);
}

const today = new Date().toISOString().slice(0, 10);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('MemoryService write-through on the event bus', () => {
  let unsubscribe: (() => void) | null = null;

  beforeEach(async () => {
    await cleanup();
    unsubscribe = initMemoryService();
  });

  afterEach(async () => {
    unsubscribe?.();
    eventBus.clear();
    await cleanup();
  });

  it('records sleep / water / food / exercise / medication habits', async () => {
    eventBus.emit('sleep_logged', { userId: USER, hours: 7 });
    eventBus.emit('water_logged', { userId: USER, amount: 8 });
    eventBus.emit('food_logged', { userId: USER, mealType: 'lunch' });
    eventBus.emit('exercise_completed', { userId: USER, type: 'walking', duration: 25 });
    eventBus.emit('medication_logged', { userId: USER, name: 'iron', taken: true });
    await flush();

    const db = getDb();
    const rows = await db.select().from(companionMemory);
    const keys = rows.map((r) => r.key);

    expect(keys).toContain(`habit.sleep.${today}`);
    expect(keys).toContain(`habit.water.${today}`);
    expect(keys).toContain(`habit.food.${today}`);
    expect(keys).toContain(`habit.exercise.${today}`);
    expect(keys).toContain(`habit.medication.${today}`);
  });

  it('records mood history, period start, period prediction and petting', async () => {
    eventBus.emit('mood_logged', { userId: USER, moodLogId: 'm-1', mood: 'happy', intensity: 3 });
    eventBus.emit('period_logged', { userId: USER, cycleEntryId: 'c-1', date: '2026-07-25' });
    eventBus.emit('period_approaching', { userId: USER, daysUntil: 2 });
    eventBus.emit('luna_petted', { userId: USER });
    await flush();

    const db = getDb();
    const rows = await db.select().from(companionMemory);
    const keys = rows.map((r) => r.key);

    expect(keys).toContain('mood.history');
    expect(keys).toContain('cycle.last_period');
    expect(keys).toContain('cycle.period_prediction');
    expect(keys).toContain(`pref.pet.${today}`);

    const petRow = rows.find((r) => r.key === `pref.pet.${today}`);
    const plain = await memoryCrypto.decrypt(USER, petRow!.value);
    expect(JSON.parse(plain!)).toEqual({ count: 1 });
  });

  it('duplicate same-day events never double-count (idempotent per-day keys)', async () => {
    eventBus.emit('sleep_logged', { userId: USER, hours: 7 });
    eventBus.emit('sleep_logged', { userId: USER, hours: 9 });
    eventBus.emit('luna_petted', { userId: USER });
    eventBus.emit('luna_petted', { userId: USER });
    await flush();

    const db = getDb();
    const sleepRows = await db
      .select()
      .from(companionMemory)
      .where(sql`${companionMemory.key} LIKE 'habit.sleep.%'`);
    expect(sleepRows).toHaveLength(1);
    expect(await memoryService.getHabitAverage(USER, 'sleep')).toBe(9);

    const petRows = await db
      .select()
      .from(companionMemory)
      .where(sql`${companionMemory.key} LIKE 'pref.pet.%'`);
    expect(petRows).toHaveLength(1);
  });

  it('sanitizes unknown moods to neutral', async () => {
    eventBus.emit('mood_logged', { userId: USER, moodLogId: 'm-2', mood: 'cosmic', intensity: 1 });
    await flush();

    const snap = await memoryService.getContextSnapshot(USER);
    expect(snap.moodHistory).toEqual(['neutral']);
  });

  it('unsubscribes cleanly (no listeners left after cleanup)', () => {
    unsubscribe?.();
    unsubscribe = null;
    expect(eventBus.listenerCount('sleep_logged')).toBe(0);
    expect(eventBus.listenerCount('mood_logged')).toBe(0);
    expect(eventBus.listenerCount('luna_petted')).toBe(0);
  });
});
