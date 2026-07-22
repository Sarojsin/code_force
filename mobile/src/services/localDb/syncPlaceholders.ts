import { getNativeDb } from '../../db/connection';
import { useAuthStore } from '../../stores/authStore';

const JSON_COLS: Record<string, string[]> = {
  cycle_entries: ['symptoms', 'mood_tags'],
  emergency_contacts: [],
  sos_alerts: [],
  journal_entries: [],
  mood_logs: [],
  pregnancy_profiles: ['allergies'],
  pregnancy_milestones: [],
  family_links: ['permissions'],
  health_insights: [],
  feature_flags: [],
};

function getUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

function parseRow(table: string, row: any): any {
  if (!row) return row;
  const cols = JSON_COLS[table] ?? [];
  for (const col of cols) {
    if (typeof row[col] === 'string') {
      try { row[col] = JSON.parse(row[col]); } catch { row[col] = []; }
    } else if (row[col] == null) {
      row[col] = [];
    }
  }
  return row;
}

function parseRows(table: string, rows: any[]): any[] {
  return rows.map(r => parseRow(table, r));
}

function safeQuery<T>(table: string, sql: string, params: any[]): T[] {
  try {
    const rows = getNativeDb().getAllSync(sql, params) as T[];
    return parseRows(table, rows) as T[];
  } catch {
    return [];
  }
}

function safeFirst<T>(table: string, sql: string, params: any[]): T | undefined {
  try {
    const row = getNativeDb().getFirstSync(sql, params) as T | undefined;
    return parseRow(table, row) as T | undefined;
  } catch {
    return undefined;
  }
}

export function placeholderCycleEntries(limit = 50): any[] | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  const rows = safeQuery<any>(
    'cycle_entries',
    'SELECT * FROM cycle_entries WHERE user_id = ? AND is_active = 1 ORDER BY period_start_date DESC LIMIT ?',
    [userId, limit],
  );
  return rows.length > 0 ? rows : undefined;
}

export function placeholderCycleById(id: string): any | undefined {
  return safeFirst<any>('cycle_entries', 'SELECT * FROM cycle_entries WHERE id = ?', [id]);
}

export function placeholderJournalEntries(limit = 50): any[] | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  const rows = safeQuery<any>(
    'journal_entries',
    'SELECT * FROM journal_entries WHERE user_id = ? AND is_active = 1 ORDER BY entry_date DESC LIMIT ?',
    [userId, limit],
  );
  return rows.length > 0 ? rows : undefined;
}

export function placeholderMoodLogs(limit = 50): any[] | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  const rows = safeQuery<any>(
    'mood_logs',
    'SELECT * FROM mood_logs WHERE user_id = ? AND is_active = 1 ORDER BY logged_at DESC LIMIT ?',
    [userId, limit],
  );
  return rows.length > 0 ? rows : undefined;
}

export function placeholderEmergencyContacts(): any[] | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  const rows = safeQuery<any>(
    'emergency_contacts',
    'SELECT * FROM emergency_contacts WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC',
    [userId],
  );
  return rows.length > 0 ? rows : undefined;
}

export function placeholderActiveSos(): any | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  return safeFirst<any>(
    'sos_alerts',
    "SELECT * FROM sos_alerts WHERE user_id = ? AND is_active = 1 AND cancelled_at IS NULL AND resolved_at IS NULL ORDER BY triggered_at DESC LIMIT 1",
    [userId],
  );
}

export function placeholderSosHistory(): any[] | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  const rows = safeQuery<any>(
    'sos_alerts',
    'SELECT * FROM sos_alerts WHERE user_id = ? ORDER BY triggered_at DESC LIMIT 50',
    [userId],
  );
  return rows.length > 0 ? rows : undefined;
}

export function placeholderPregnancyProfile(): any | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  return safeFirst<any>(
    'pregnancy_profiles',
    'SELECT * FROM pregnancy_profiles WHERE user_id = ? LIMIT 1',
    [userId],
  );
}

export function placeholderPregnancyMilestones(): any[] | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  const rows = safeQuery<any>(
    'pregnancy_milestones',
    'SELECT * FROM pregnancy_milestones WHERE user_id = ? ORDER BY week ASC',
    [userId],
  );
  return rows.length > 0 ? rows : undefined;
}

export function placeholderFamilyLinks(): any[] | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  const rows = safeQuery<any>(
    'family_links',
    'SELECT * FROM family_links WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC',
    [userId],
  );
  return rows.length > 0 ? rows : undefined;
}

export function placeholderInsights(): any | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  return safeFirst<any>(
    'health_insights',
    'SELECT * FROM health_insights WHERE user_id = ? LIMIT 1',
    [userId],
  );
}

export function placeholderCyclePredictions(): any | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  const latest = safeFirst<any>(
    'cycle_entries',
    'SELECT * FROM cycle_entries WHERE user_id = ? AND is_active = 1 ORDER BY period_start_date DESC LIMIT 1',
    [userId],
  );
  if (!latest) return undefined;
  // If the most recent entry is anovulatory, suspend predictions offline too
  if (latest.cycle_type === 'anovulatory') {
    return {
      prediction: null,
      days_until: null,
      model_used: 'local',
      data_quality: 'insufficient',
    };
  }
  const predictedStart = latest.period_end_date
    ? new Date(new Date(latest.period_end_date).getTime() + 28 * 86400000)
    : null;
  const predictedEnd = predictedStart
    ? new Date(predictedStart.getTime() + 5 * 86400000)
    : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = predictedStart
    ? Math.max(0, Math.round((predictedStart.getTime() - today.getTime()) / 86400000))
    : null;
  return {
    prediction: predictedStart
      ? {
          id: latest.id,
          predicted_next_period_start: predictedStart.toISOString().split('T')[0],
          predicted_period_end: predictedEnd?.toISOString().split('T')[0] ?? null,
          model_type: 'local',
          confidence_label: 'offline_estimate',
          training_data_points: 1,
        }
      : null,
    days_until: daysUntil,
    model_used: 'local',
    data_quality: 'insufficient',
  };
}

export function placeholderCycleCalendar(): any | undefined {
  const userId = getUserId();
  if (!userId) return undefined;
  const entries = safeQuery<any>(
    'cycle_entries',
    'SELECT * FROM cycle_entries WHERE user_id = ? AND is_active = 1 ORDER BY period_start_date DESC LIMIT 12',
    [userId],
  );
  if (entries.length === 0) return undefined;
  const days: Record<string, string> = {};
  for (const entry of entries) {
    const start = new Date(entry.period_start_date);
    const end = entry.period_end_date ? new Date(entry.period_end_date) : new Date(start.getTime() + 5 * 86400000);
    const cur = new Date(start);
    while (cur <= end) {
      days[cur.toISOString().split('T')[0]] = 'P';
      cur.setDate(cur.getDate() + 1);
    }
  }
  return {
    days,
    entries,
    predictions: placeholderCyclePredictions() ?? null,
  };
}

export function placeholderFeatureFlags(): Record<string, boolean> | undefined {
  try {
    const rows = getNativeDb().getAllSync(
      'SELECT key, value FROM feature_flags',
    ) as { key: string; value: number }[];
    if (rows.length === 0) return undefined;
    const flags: Record<string, boolean> = {};
    for (const row of rows) {
      flags[row.key] = row.value === 1;
    }
    return flags;
  } catch {
    return undefined;
  }
}
