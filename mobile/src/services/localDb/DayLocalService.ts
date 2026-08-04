import { getDb } from '../../db/connection';
import { cycleDays } from '../../db/schema';
import type { CycleDay } from '../../db/schema';
import type { DailyDay } from '../api/cycle';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

/**
 * Local SQLite service for the canonical per-day observation record
 * (`cycle_days`). Reads use a denormalized JSON view of symptoms/medications
 * stored on the row (see schema.ts §23), so offline reopen needs no joins.
 *
 * Server rows (`DailyDay`) are normalized into local rows via `fromServer`.
 */
const SYMPTOM_KEYS = ['name', 'severity'] as const;
const MEDICATION_KEYS = ['name', 'dose', 'taken_at'] as const;

export function normalizeDayServerData(serverData: Record<string, unknown>): Record<string, unknown> {
  const rawSymptoms: unknown = serverData.symptoms ?? [];
  const rawMeds: unknown = serverData.medications ?? [];
  return {
    ...serverData,
    symptoms: Array.isArray(rawSymptoms)
      ? rawSymptoms.map((s) => pick(s, SYMPTOM_KEYS))
      : [],
    medications: Array.isArray(rawMeds)
      ? rawMeds.map((m) => pick(m, MEDICATION_KEYS))
      : [],
  };
}

function pick(obj: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in obj) (out as Record<string, unknown>)[key] = (obj as Record<string, unknown>)[key];
  }
  return out;
}

export class DayLocalService extends BaseLocalService<CycleDay> {
  protected table = cycleDays;
  protected tableName = 'cycle_days';

  async upsertDayFromServer(serverData: Record<string, unknown>): Promise<void> {
    try {
      await super.upsert(normalizeDayServerData(serverData) as unknown as CycleDay);
    } catch (error) {
      this.handleError('upsertDayFromServer', error);
    }
  }

  async getByDate(userId: string, logDate: string): Promise<CycleDay | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(cycleDays)
        .where(and(eq(cycleDays.user_id, userId), eq(cycleDays.log_date, logDate), eq(cycleDays.is_active, true)))
        .limit(1);
      return (result as CycleDay[])[0] ?? null;
    } catch (error) {
      this.handleError('getByDate', error);
      return null;
    }
  }

  async getByRange(userId: string, start?: string, end?: string): Promise<CycleDay[]> {
    try {
      const db = getDb();
      const conditions = [eq(cycleDays.user_id, userId), eq(cycleDays.is_active, true)];
      if (start) conditions.push(gte(cycleDays.log_date, start));
      if (end) conditions.push(lte(cycleDays.log_date, end));
      return (await db
        .select()
        .from(cycleDays)
        .where(and(...conditions))
        .orderBy(desc(cycleDays.log_date))) as CycleDay[];
    } catch (error) {
      this.handleError('getByRange', error);
      return [];
    }
  }

  /** Convenience: normalize a server `DailyDay` for JSON writes. */
  toLocal(day: DailyDay): Record<string, unknown> {
    return normalizeDayServerData(day as unknown as Record<string, unknown>);
  }
}