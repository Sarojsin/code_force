import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../../db/schema';
import { CycleLocalService } from '../CycleLocalService';
import { JournalLocalService } from '../JournalLocalService';
import { MoodLocalService } from '../MoodLocalService';
import { EmergencyContactLocalService } from '../EmergencyContactLocalService';
import { SosAlertLocalService } from '../SosAlertLocalService';
import { PregnancyProfileLocalService } from '../PregnancyProfileLocalService';
import { PregnancyMilestoneLocalService } from '../PregnancyMilestoneLocalService';
import { FamilyLinkLocalService } from '../FamilyLinkLocalService';
import { HealthInsightLocalService } from '../HealthInsightLocalService';
import { FeatureFlagLocalService } from '../FeatureFlagLocalService';

jest.mock('../../../db/connection', () => ({
  getDb: jest.fn(),
}));

const { getDb } = jest.requireMock('../../../db/connection');

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cycle_entries (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, period_start_date TEXT NOT NULL,
      period_end_date TEXT, flow_intensity TEXT, symptoms TEXT DEFAULT '[]',
      mood_tags TEXT DEFAULT '[]', energy_level INTEGER, notes TEXT,
      is_correction INTEGER DEFAULT 0, corrected_prediction_id TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1, deleted_at TEXT, synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT, content TEXT NOT NULL,
      mood TEXT, sentiment_score INTEGER, sentiment_label TEXT,
      entry_date TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1, deleted_at TEXT, synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mood_logs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, mood TEXT NOT NULL,
      intensity INTEGER NOT NULL, notes TEXT, logged_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1, deleted_at TEXT, synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
      phone_number TEXT NOT NULL, relationship TEXT, is_primary INTEGER DEFAULT 0,
      contact_user_id TEXT, contact_user_id_linked_at TEXT,
      is_active INTEGER DEFAULT 1, deleted_at TEXT, synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sos_alerts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, triggered_at TEXT,
      latitude INTEGER NOT NULL, longitude INTEGER NOT NULL,
      location_accuracy_m INTEGER, sms_status TEXT NOT NULL,
      cancelled_at TEXT, resolved_at TEXT, false_alarm INTEGER DEFAULT 0,
      manual_intervention_needed INTEGER DEFAULT 0, trigger_source TEXT,
      is_active INTEGER DEFAULT 1, deleted_at TEXT, synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pregnancy_profiles (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, due_date TEXT,
      weeks_pregnant INTEGER NOT NULL, trimester INTEGER NOT NULL,
      baby_name TEXT, blood_type TEXT, allergies TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pregnancy_milestones (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, week INTEGER NOT NULL,
      title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0, completed_at TEXT, synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS family_links (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, linked_user_id TEXT,
      status TEXT NOT NULL, permissions TEXT DEFAULT '[]',
      created_at TEXT NOT NULL, is_active INTEGER DEFAULT 1,
      deleted_at TEXT, synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS health_insights (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      total_journal_entries INTEGER DEFAULT 0, total_mood_logs INTEGER DEFAULT 0,
      average_mood_intensity INTEGER, most_common_mood TEXT, recommendation TEXT,
      synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feature_flags (
      key TEXT PRIMARY KEY, value INTEGER DEFAULT 0, synced_at TEXT NOT NULL
    );
  `);

  return db;
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

function mockCycleEntry2(overrides = {}): any {
  return mockCycleEntry({
    id: 'cycle-2',
    period_start_date: '2026-06-20',
    period_end_date: '2026-06-25',
    ...overrides,
  });
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

function mockMoodLog(overrides = {}): any {
  return {
    id: 'mood-1',
    user_id: 'user-1',
    mood: 'anxious',
    intensity: 7,
    notes: 'Feeling stressed about work',
    logged_at: '2026-07-15T14:00:00Z',
    is_active: true,
    deleted_at: null,
    synced_at: '2026-07-15T14:00:00Z',
    ...overrides,
  };
}

function mockContact(overrides = {}): any {
  return {
    id: 'contact-1',
    user_id: 'user-1',
    name: 'Jane Doe',
    phone_number: '+1234567890',
    relationship: 'sister',
    is_primary: true,
    contact_user_id: null,
    contact_user_id_linked_at: null,
    is_active: true,
    deleted_at: null,
    synced_at: '2026-07-15T12:00:00Z',
    ...overrides,
  };
}

function mockSosAlert(overrides = {}): any {
  return {
    id: 'sos-1',
    user_id: 'user-1',
    triggered_at: '2026-07-15T14:00:00Z',
    latitude: 40,
    longitude: -73,
    location_accuracy_m: 10,
    sms_status: 'sent',
    cancelled_at: null,
    resolved_at: null,
    false_alarm: false,
    manual_intervention_needed: false,
    trigger_source: 'button',
    is_active: true,
    deleted_at: null,
    synced_at: '2026-07-15T14:00:00Z',
    ...overrides,
  };
}

function mockPregnancyProfile(overrides = {}): any {
  return {
    id: 'preg-1',
    user_id: 'user-1',
    due_date: '2026-12-01',
    weeks_pregnant: 20,
    trimester: 2,
    baby_name: null,
    blood_type: 'O+',
    allergies: ['penicillin'],
    created_at: '2026-07-15T12:00:00Z',
    updated_at: '2026-07-15T12:00:00Z',
    synced_at: '2026-07-15T12:00:00Z',
    ...overrides,
  };
}

function mockMilestone(overrides = {}): any {
  return {
    id: 'ms-1',
    user_id: 'user-1',
    week: 20,
    title: 'Halfway there',
    description: 'Baby is growing strong',
    category: 'milestone',
    is_completed: true,
    completed_at: '2026-07-15T12:00:00Z',
    synced_at: '2026-07-15T12:00:00Z',
    ...overrides,
  };
}

function mockFamilyLink(overrides = {}): any {
  return {
    id: 'link-1',
    user_id: 'user-1',
    linked_user_id: 'user-2',
    status: 'accepted',
    permissions: ['cycle:read'],
    created_at: '2026-07-15T12:00:00Z',
    is_active: true,
    deleted_at: null,
    synced_at: '2026-07-15T12:00:00Z',
    ...overrides,
  };
}

function mockHealthInsight(overrides = {}): any {
  return {
    id: 'insight-1',
    user_id: 'user-1',
    total_journal_entries: 5,
    total_mood_logs: 10,
    average_mood_intensity: 6,
    most_common_mood: 'happy',
    recommendation: 'Try meditation for stress',
    synced_at: '2026-07-15T12:00:00Z',
    ...overrides,
  };
}

function mockFeatureFlag(overrides = {}): any {
  return {
    key: 'dark_mode',
    value: true,
    synced_at: '2026-07-15T12:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  const db = createTestDb();
  getDb.mockReturnValue(db);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('CycleLocalService', () => {
  let service: CycleLocalService;

  beforeEach(() => {
    service = new CycleLocalService();
  });

  it('upserts and retrieves a cycle entry', async () => {
    await service.upsert(mockCycleEntry());
    const result = await service.getById('cycle-1');
    expect(result).not.toBeNull();
    expect(result?.period_start_date).toBe('2026-01-15');
  });

  it('upserts many records', async () => {
    await service.upsertMany([mockCycleEntry(), mockCycleEntry2()]);
    const history = await service.getHistory('user-1');
    expect(history).toHaveLength(2);
  });

  it('returns empty array when no records', async () => {
    const history = await service.getHistory('non-existent');
    expect(history).toEqual([]);
  });

  it('soft-deletes a record', async () => {
    await service.upsert(mockCycleEntry());
    await service.softDelete('cycle-1');
    const result = await service.getById('cycle-1');
    expect(result?.is_active).toBe(false);
    expect(result?.deleted_at).toBeTruthy();
  });

  it('excludes soft-deleted records from getHistory', async () => {
    await service.upsert(mockCycleEntry());
    await service.softDelete('cycle-1');
    const history = await service.getHistory('user-1');
    expect(history).toHaveLength(0);
  });

  it('gets latest entry', async () => {
    await service.upsert(mockCycleEntry());
    await service.upsert(mockCycleEntry2());
    const latest = await service.getLatest('user-1');
    expect(latest?.id).toBe('cycle-2');
  });

  it('returns null for getLatest when no entries', async () => {
    const latest = await service.getLatest('user-1');
    expect(latest).toBeNull();
  });

  it('upsert on conflict updates the existing record', async () => {
    await service.upsert(mockCycleEntry({ notes: 'Original note' }));
    await service.upsert(mockCycleEntry({ notes: 'Updated note' }));
    const result = await service.getById('cycle-1');
    expect(result?.notes).toBe('Updated note');
  });
});

describe('JournalLocalService', () => {
  let service: JournalLocalService;

  beforeEach(() => {
    service = new JournalLocalService();
  });

  it('upserts and retrieves a journal entry', async () => {
    await service.upsert(mockJournalEntry());
    const result = await service.getById('journal-1');
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Good day');
  });

  it('gets recent entries', async () => {
    await service.upsert(mockJournalEntry());
    const recent = await service.getRecent('user-1');
    expect(recent).toHaveLength(1);
  });

  it('gets entry by date', async () => {
    await service.upsert(mockJournalEntry());
    const entry = await service.getByDate('user-1', '2026-07-15');
    expect(entry?.id).toBe('journal-1');
  });

  it('returns null for non-existent date', async () => {
    const entry = await service.getByDate('user-1', '2025-01-01');
    expect(entry).toBeNull();
  });

  it('gets journal entries by mood tags', async () => {
    await service.upsert(mockJournalEntry({ mood: 'happy' }));
    await service.upsert(mockJournalEntry({ id: 'journal-2', mood: 'sad', content: 'Bad day' }));
    const happyEntries = await service.getByMoodTags('user-1', ['happy']);
    expect(happyEntries).toHaveLength(1);
    expect(happyEntries[0].id).toBe('journal-1');
  });
});

describe('MoodLocalService', () => {
  let service: MoodLocalService;

  beforeEach(() => {
    service = new MoodLocalService();
  });

  it('gets mood logs by date range', async () => {
    await service.upsert(mockMoodLog());
    const logs = await service.getByDateRange('user-1', '2026-07-01', '2026-07-31');
    expect(logs).toHaveLength(1);
    expect(logs[0].mood).toBe('anxious');
  });

  it('returns empty for range with no data', async () => {
    const logs = await service.getByDateRange('user-1', '2025-01-01', '2025-01-31');
    expect(logs).toEqual([]);
  });

  it('gets average intensity by month', async () => {
    await service.upsert(mockMoodLog({ intensity: 7, logged_at: '2026-07-15T14:00:00Z' }));
    await service.upsert(mockMoodLog({ id: 'mood-2', intensity: 5, logged_at: '2026-07-16T14:00:00Z' }));
    const averages = await service.getAverageByMonth('user-1', 6);
    expect(averages.length).toBeGreaterThanOrEqual(1);
    expect(averages[0].month).toBe('2026-07');
    expect(Number(averages[0].avg_intensity)).toBe(6);
  });
});

describe('EmergencyContactLocalService', () => {
  let service: EmergencyContactLocalService;

  beforeEach(() => {
    service = new EmergencyContactLocalService();
  });

  it('gets contacts by user', async () => {
    await service.upsert(mockContact());
    const contacts = await service.getByUser('user-1');
    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe('Jane Doe');
  });
});

describe('SosAlertLocalService', () => {
  let service: SosAlertLocalService;

  beforeEach(() => {
    service = new SosAlertLocalService();
  });

  it('gets SOS alerts by user', async () => {
    await service.upsert(mockSosAlert());
    const alerts = await service.getByUser('user-1');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].sms_status).toBe('sent');
  });

  it('returns empty for user with no alerts', async () => {
    const alerts = await service.getByUser('no-sos');
    expect(alerts).toEqual([]);
  });
});

describe('PregnancyProfileLocalService', () => {
  let service: PregnancyProfileLocalService;

  beforeEach(() => {
    service = new PregnancyProfileLocalService();
  });

  it('upserts and retrieves a pregnancy profile', async () => {
    await service.upsert(mockPregnancyProfile());
    const result = await service.getByUser('user-1');
    expect(result).not.toBeNull();
    expect(result?.weeks_pregnant).toBe(20);
  });

  it('returns null for non-existent user', async () => {
    const result = await service.getByUser('no-user');
    expect(result).toBeNull();
  });
});

describe('PregnancyMilestoneLocalService', () => {
  let service: PregnancyMilestoneLocalService;

  beforeEach(() => {
    service = new PregnancyMilestoneLocalService();
  });

  it('gets milestones by user', async () => {
    await service.upsert(mockMilestone());
    const milestones = await service.getByUser('user-1');
    expect(milestones).toHaveLength(1);
    expect(milestones[0].title).toBe('Halfway there');
  });

  it('returns empty for user with no milestones', async () => {
    const milestones = await service.getByUser('no-user');
    expect(milestones).toEqual([]);
  });
});

describe('FamilyLinkLocalService', () => {
  let service: FamilyLinkLocalService;

  beforeEach(() => {
    service = new FamilyLinkLocalService();
  });

  it('gets family links by user', async () => {
    await service.upsert(mockFamilyLink());
    const links = await service.getByUser('user-1');
    expect(links).toHaveLength(1);
    expect(links[0].status).toBe('accepted');
  });

  it('gets family links by status', async () => {
    await service.upsert(mockFamilyLink());
    await service.upsert(mockFamilyLink({ id: 'link-2', status: 'pending' }));
    const accepted = await service.getByStatus('user-1', 'accepted');
    expect(accepted).toHaveLength(1);
  });
});

describe('HealthInsightLocalService', () => {
  let service: HealthInsightLocalService;

  beforeEach(() => {
    service = new HealthInsightLocalService();
  });

  it('gets insight by user', async () => {
    await service.upsert(mockHealthInsight());
    const result = await service.getByUser('user-1');
    expect(result).not.toBeNull();
    expect(result?.most_common_mood).toBe('happy');
  });

  it('returns null for non-existent user', async () => {
    const result = await service.getByUser('no-user');
    expect(result).toBeNull();
  });

  it('gets insights by category', async () => {
    await service.upsert(mockHealthInsight());
    const results = await service.getByCategory('user-1', 'meditation');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('insight-1');
  });
});

describe('FeatureFlagLocalService', () => {
  let service: FeatureFlagLocalService;

  beforeEach(() => {
    service = new FeatureFlagLocalService();
  });

  it('upserts and retrieves a feature flag by key', async () => {
    await service.upsert(mockFeatureFlag());
    const result = await service.getByKey('dark_mode');
    expect(result).not.toBeNull();
    expect(result?.value).toBe(true);
  });

  it('returns all feature flags', async () => {
    await service.upsert(mockFeatureFlag());
    await service.upsert(mockFeatureFlag({ key: 'voice_enabled', value: false }));
    const all = await service.getAll();
    expect(all).toHaveLength(2);
  });
});

describe('BaseLocalService base methods', () => {
  let service: CycleLocalService;

  beforeEach(() => {
    service = new CycleLocalService();
  });

  it('getAllByUser returns records for a user', async () => {
    await service.upsert(mockCycleEntry());
    await service.upsert(mockCycleEntry2());
    const rows = await service.getAllByUser('user-1');
    expect(rows).toHaveLength(2);
  });

  it('getAllByUser respects limit and offset', async () => {
    await service.upsert(mockCycleEntry());
    await service.upsert(mockCycleEntry2());
    const rows = await service.getAllByUser('user-1', { limit: 1, offset: 0 });
    expect(rows).toHaveLength(1);
  });

  it('getSyncedBefore returns records synced before timestamp', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    await service.upsert(mockCycleEntry());
    const old = await service.getSyncedBefore(future);
    expect(old).toHaveLength(1);
  });
});

describe('Error handling', () => {
  it('getById returns null when DB fails', async () => {
    getDb.mockImplementation(() => { throw new Error('DB error'); });
    const service = new CycleLocalService();
    const result = await service.getById('any');
    expect(result).toBeNull();
  });

  it('upsert does not throw when DB fails', async () => {
    getDb.mockImplementation(() => { throw new Error('DB error'); });
    const service = new CycleLocalService();
    await expect(service.upsert(mockCycleEntry())).resolves.toBeUndefined();
  });

  it('getHistory returns empty array when DB fails', async () => {
    getDb.mockImplementation(() => { throw new Error('DB error'); });
    const service = new CycleLocalService();
    const result = await service.getHistory('user-1');
    expect(result).toEqual([]);
  });

  it('getSyncedBefore returns empty array when DB fails', async () => {
    getDb.mockImplementation(() => { throw new Error('DB error'); });
    const service = new CycleLocalService();
    const result = await service.getSyncedBefore('2026-01-01');
    expect(result).toEqual([]);
  });

  it('getAllByUser returns empty array when DB fails', async () => {
    getDb.mockImplementation(() => { throw new Error('DB error'); });
    const service = new CycleLocalService();
    const result = await service.getAllByUser('user-1');
    expect(result).toEqual([]);
  });
});
