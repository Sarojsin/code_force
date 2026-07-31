import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import * as schema from '../db/schema';
import { localDb } from '../services/localDb';
import { hydrateFromServerData, hydrateChangeItems } from '../services/sync/syncHydrate';
import { pruneLocalDb } from '../services/localDb/pruneLocalDb';

jest.mock('../db/connection', () => ({
  getDb: jest.fn(),
  getNativeDb: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
  setTag: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock('src/utils', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
    clear: jest.fn(async () => { Object.keys(store).forEach(k => delete store[k]); }),
    __store: store,
  };
});

const { getDb, getNativeDb } = jest.requireMock('../db/connection');

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  migrate(db, {
    migrationsFolder: path.join(process.cwd(), 'src/db/migrations'),
  });

  return { sqlite, db };
}

function mockCycleEntry(overrides = {}): any {
  return {
    id: 'cycle-1',
    user_id: 'user-1',
    period_start_date: '2026-01-15',
    period_end_date: '2026-01-20',
    flow_intensity: 'medium',
    symptoms: ['bloating', 'cramps'],
    mood_tags: ['irritable', 'tired'],
    energy_level: 3,
    notes: 'Felt okay',
    is_correction: false,
    corrected_prediction_id: null,
    created_at: '2026-01-15T08:00:00Z',
    updated_at: '2026-01-20T18:00:00Z',
    is_active: true,
    deleted_at: null,
    synced_at: '2026-01-20T18:00:00Z',
    ...overrides,
  };
}

function mockJournalEntry(overrides = {}): any {
  return {
    id: 'journal-1',
    user_id: 'user-1',
    title: 'Good day',
    content: 'Had a productive day at work.',
    mood: 'happy',
    sentiment_score: 75,
    sentiment_label: 'positive',
    entry_date: '2026-07-15',
    created_at: '2026-07-15T12:00:00Z',
    updated_at: '2026-07-15T12:00:00Z',
    is_active: true,
    deleted_at: null,
    synced_at: '2026-07-15T12:00:00Z',
    ...overrides,
  };
}

let dbContext: { sqlite: Database.Database; db: ReturnType<typeof drizzle> };

function wrappedNativeDb(sqlite: Database.Database) {
  return {
    runSync: (sql: string, params?: any[]) => {
      const stmt = sqlite.prepare(sql);
      const info = stmt.run(...(params ?? []));
      return { changes: info.changes };
    },
    getAllSync: (sql: string, params?: any[]) => {
      return sqlite.prepare(sql).all(...(params ?? []));
    },
    getFirstSync: (sql: string, params?: any[]) => {
      return sqlite.prepare(sql).get(...(params ?? [])) ?? null;
    },
    exec: (sql: string) => sqlite.exec(sql),
  };
}

beforeEach(() => {
  dbContext = createTestDb();
  getDb.mockReturnValue(dbContext.db);
  getNativeDb.mockReturnValue(wrappedNativeDb(dbContext.sqlite));
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Phase 2 Storage Integration', () => {
  describe('Write → Sync → SQLite → Read', () => {
    it('hydrates SQLite on push success and reads it back', async () => {
      await hydrateFromServerData('cycle/create', mockCycleEntry());

      const result = await localDb.cycle.getById('cycle-1');
      expect(result).not.toBeNull();
      expect(result?.period_start_date).toBe('2026-01-15');
    });

    it('hydrates SQLite on pull and reads it back', async () => {
      const changes = [
        {
          entity_type: 'journal',
          entity_id: 'journal-1',
          action: 'created',
          data: mockJournalEntry(),
          updated_at: '2026-07-15T12:00:00Z',
        },
      ];

      await hydrateChangeItems(changes as any);

      const result = await localDb.journal.getById('journal-1');
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Good day');
    });

    it('soft-deletes from SQLite on pull delete action', async () => {
      await localDb.cycle.upsert(mockCycleEntry());

      const changes = [
        {
          entity_type: 'cycle',
          entity_id: 'cycle-1',
          action: 'deleted',
          data: null,
          updated_at: '2026-07-15T12:00:00Z',
        },
      ];

      await hydrateChangeItems(changes as any);

      const result = await localDb.cycle.getById('cycle-1');
      expect(result?.is_active).toBe(false);
    });
  });

  describe('Conflict resolution', () => {
    it('overwrites SQLite with server data on conflict', async () => {
      await localDb.cycle.upsert(mockCycleEntry({ period_start_date: '2026-01-15' }));

      await hydrateFromServerData('cycle/update', mockCycleEntry({ period_start_date: '2026-02-01' }));

      const result = await localDb.cycle.getById('cycle-1');
      expect(result?.period_start_date).toBe('2026-02-01');
    });
  });

  describe('Prune local DB', () => {
    it('hard-deletes soft-deleted records older than 30 days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      await localDb.cycle.upsert(mockCycleEntry({
        is_active: false,
        deleted_at: oldDate.toISOString(),
      }));

      pruneLocalDb();

      const result = await localDb.cycle.getById('cycle-1');
      expect(result).toBeNull();
    });

    it('keeps recent soft-deleted records', async () => {
      await localDb.cycle.upsert(mockCycleEntry({
        is_active: false,
        deleted_at: new Date().toISOString(),
      }));

      pruneLocalDb();

      const result = await localDb.cycle.getById('cycle-1');
      expect(result).not.toBeNull();
    });
  });

  describe('SQLite read path', () => {
    it('returns data from SQLite when available', async () => {
      await localDb.cycle.upsert(mockCycleEntry());

      const entries = await localDb.cycle.getAllByUser('user-1');
      expect(entries).toHaveLength(1);
    });

    it('returns empty array when no data and graceful fallback', async () => {
      const entries = await localDb.cycle.getAllByUser('no-user');
      expect(entries).toEqual([]);
    });
  });

  describe('Soft delete awareness', () => {
    it('excludes soft-deleted records from getHistory', async () => {
      await localDb.cycle.upsert(mockCycleEntry());
      await localDb.cycle.softDelete('cycle-1');

      const history = await localDb.cycle.getHistory('user-1');
      expect(history).toHaveLength(0);
    });
  });

  describe('Feature flags service', () => {
    it('upserts and retrieves feature flags', async () => {
      await localDb.featureFlag.upsert({ key: 'dark_mode', value: true, synced_at: '2026-01-01T00:00:00Z' } as any);

      const flag = await localDb.featureFlag.getByKey('dark_mode');
      expect(flag).not.toBeNull();
      expect(flag?.value).toBe(true);
    });

    it('returns all feature flags', async () => {
      await localDb.featureFlag.upsert({ key: 'dark_mode', value: true, synced_at: '2026-01-01T00:00:00Z' } as any);
      await localDb.featureFlag.upsert({ key: 'voice_enabled', value: false, synced_at: '2026-01-01T00:00:00Z' } as any);

      const all = await localDb.featureFlag.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('Error handling', () => {
    it('hydrateFromServerData does not throw on invalid operation type', async () => {
      await expect(hydrateFromServerData('unknown/type', {} as any)).resolves.toBeUndefined();
    });

    it('SQLite write failure does not crash', async () => {
      getNativeDb.mockImplementation(() => { throw new Error('DB error'); });
      await expect(localDb.cycle.upsert(mockCycleEntry())).resolves.toBeUndefined();
    });
  });
});
