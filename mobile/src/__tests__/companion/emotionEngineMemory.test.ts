// emotionEngineMemory.test.ts — mood persistence across sessions + relationship level

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
import { companionMemory, companionMetadata } from '../../db/schema';
import { memoryService } from '../../services/companion/memoryService';
import { EmotionEngine, createEmotionEngine } from '../../services/companion/EmotionEngine';
import { companionLocalService } from '../../services/localDb';
import { useCompanionStore, calculateRelationshipLevel, RELATIONSHIP_THRESHOLDS } from '../../stores/companionStore';

const USER = 'emotion-mem-user';

async function cleanup() {
  const db = getDb();
  await db.delete(companionMemory).where(sql`1 = 1`);
  await db.delete(companionMetadata).where(sql`user_id = ${USER}`);
}

describe('relationship level thresholds', () => {
  it('increments on cumulative XP thresholds, separate from XP level titles', () => {
    expect(calculateRelationshipLevel(0)).toBe(1);
    expect(calculateRelationshipLevel(100)).toBe(2);
    expect(calculateRelationshipLevel(500)).toBe(3);
    expect(calculateRelationshipLevel(2000)).toBe(4);
    expect(calculateRelationshipLevel(10000)).toBe(5);
    expect(calculateRelationshipLevel(50000)).toBe(6);
    expect(RELATIONSHIP_THRESHOLDS.length).toBe(5);
  });

  it('relationship level tracks cumulative XP in the store + DB', async () => {
    useCompanionStore.setState({ userId: USER, xp: 0, level: 1, relationshipLevel: 1 });

    await useCompanionStore.getState().addXP(100);
    expect(useCompanionStore.getState().relationshipLevel).toBe(2);

    await useCompanionStore.getState().addXP(400);
    expect(useCompanionStore.getState().relationshipLevel).toBe(3);

    const meta = await companionLocalService.getMetadata(USER);
    expect(meta?.relationship_level).toBe(3);

    useCompanionStore.setState({ userId: null });
  });
});

describe('mood persistence across sessions', () => {
  beforeEach(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('EmotionEngine hydrates its MoodManager from persisted memory', async () => {
    await memoryService.recordMood(USER, 'happy');
    await memoryService.recordMood(USER, 'neutral');

    useCompanionStore.setState({ userId: USER, memory: {} });
    await memoryService.hydrateMemory(USER);

    const engine = createEmotionEngine();
    const result = engine.processMood('sad', 'idle_blink');
    expect(result.history).toEqual(['happy', 'neutral', 'sad']);
    expect(result.trend).toBe('declining');
    expect(engine.getDialogueContext(result.trend, result.recommendation)).toBe('mood_sad');

    useCompanionStore.setState({ userId: null, memory: {} });
  });

  it('EmotionEngine can be seeded with history directly', () => {
    const engine = new EmotionEngine(['sad', 'sad', 'sad']);
    const result = engine.processMood('happy', 'idle_blink');
    expect(result.trend).toBe('improving');
    expect(result.history).toHaveLength(4);
  });

  it('mood history survives a simulated session restart (persisted in memory)', async () => {
    await memoryService.recordMood(USER, 'sad');
    await memoryService.recordMood(USER, 'sad');

    // "restart" — reset store, re-hydrate from memory
    useCompanionStore.setState({ userId: USER, memory: {} });
    await memoryService.hydrateMemory(USER);

    expect(useCompanionStore.getState().memory.moodHistory).toEqual(['sad', 'sad']);

    // week-over-week aggregate exists after mood writes
    const snap = await memoryService.getContextSnapshot(USER);
    expect(snap.moodHistory).toEqual(['sad', 'sad']);

    useCompanionStore.setState({ userId: null, memory: {} });
  });
});
