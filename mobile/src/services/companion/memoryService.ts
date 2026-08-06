import { and, asc, desc, eq, gte, inArray, like, lte, sql } from 'drizzle-orm';
import { getDb } from '../../db/connection';
import { companionMemory } from '../../db/schema';
import { eventBus } from '../eventBus';
import { companionLocalService } from '../localDb';
import { memoryCrypto } from './memoryCrypto';
import { MOOD_SCORES, MOODS, type Mood, type MoodTrend } from './MoodManager';
import { useCompanionStore } from '../../stores/companionStore';
import { VOLATILITY_THRESHOLD } from '../../constants/companion';
import { logger } from '../../utils';

export type HabitType = 'sleep' | 'water' | 'food' | 'exercise' | 'medication';

export interface MemoryContext {
  habitAverages: Partial<Record<HabitType, number>>;
  frequentLogTypes: HabitType[];
  streaks: Record<HabitType, number>;
  sleepAverageHour: number | undefined;
  petCount: number;
  moodHistory: Mood[];
  moodTrend: MoodTrend | null;
  weekOverWeekMood: number | null;
  lastPeriodDate: string | null;
  daysSinceLastPeriod: number | null;
  daysUntilNextPeriod: number | null;
  relationshipLevel: number;
  lastSeenAt: number | null;
  daysSinceLastSeen: number | null;
}

const HABIT_TYPES: HabitType[] = ['sleep', 'water', 'food', 'exercise', 'medication'];

const TTL_DAYS = 60;
const MAX_ROWS = 1000;
const WINDOW_DAYS = 14;
const MIN_SAMPLES = 3;
const MOOD_HISTORY_LIMIT = 20;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TTL_MS = TTL_DAYS * MS_PER_DAY;
const WINDOW_MS = WINDOW_DAYS * MS_PER_DAY;

// ---------------------------------------------------------------------------
// Memory keys (plaintext)
// ---------------------------------------------------------------------------
const habitKey = (type: HabitType, day: string) => `habit.${type}.${day}`;
const petKey = (day: string) => `pref.pet.${day}`;
const moodHistoryKey = () => 'mood.history';
const moodWeekKey = (weekStart: string) => `mood.week_aggregate.${weekStart}`;
const periodKey = () => 'cycle.last_period';
const periodPredictionKey = () => 'cycle.period_prediction';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const weekStartOf = (d: Date) => {
  const c = new Date(d);
  const day = (c.getDay() + 6) % 7;
  c.setDate(c.getDate() - day);
  return isoDay(c);
};
const isRawKey = (key: string) => key.startsWith('habit.') || key.startsWith('pref.pet.');
const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

function computeStreak(days: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    if (days.has(isoDay(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (i === 0) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }
  return streak;
}

function computeMoodTrend(history: Mood[]): MoodTrend | null {
  if (history.length < 3) return null;
  const scores = history.map((m) => MOOD_SCORES[m]);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const first = scores[0];
  const last = scores[scores.length - 1];
  const variance = scores.reduce((sum, s) => sum + Math.abs(s - avg), 0) / scores.length;
  if (variance > VOLATILITY_THRESHOLD) return 'volatile';
  if (last > first + 2) return 'improving';
  if (last < first - 2) return 'declining';
  return 'stable';
}

class MemoryService {
  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------
  async recordHabit(
    userId: string,
    type: HabitType,
    value: number,
    loggedAt?: Date,
  ): Promise<void> {
    try {
      const ts = loggedAt ?? new Date();
      const key = habitKey(type, isoDay(ts));
      const encrypted = await memoryCrypto.encrypt(
        userId,
        JSON.stringify({ value }),
      );
      const db = getDb();
      await db
        .insert(companionMemory)
        .values({ key, value: encrypted, created_at: ts.getTime(), updated_at: Date.now() })
        .onConflictDoUpdate({
          target: companionMemory.key,
          set: { value: encrypted, updated_at: Date.now() },
        });
      await this.prune();
    } catch (error) {
      logger.warn('MemoryService.recordHabit failed', error);
    }
  }

  async recordMood(userId: string, mood: Mood): Promise<void> {
    try {
      const history = await this.loadMoodHistory(userId);
      history.push(mood);
      await this.upsertEncrypted(
        userId,
        moodHistoryKey(),
        JSON.stringify(history.slice(-MOOD_HISTORY_LIMIT)),
      );

      const weekKey = moodWeekKey(weekStartOf(new Date()));
      const existing = await this.readJson<{ total: number; count: number }>(userId, weekKey);
      const next = {
        total: (existing?.total ?? 0) + MOOD_SCORES[mood],
        count: (existing?.count ?? 0) + 1,
      };
      await this.upsertEncrypted(userId, weekKey, JSON.stringify(next));
      await this.prune();
    } catch (error) {
      logger.warn('MemoryService.recordMood failed', error);
    }
  }

  async recordPet(userId: string): Promise<void> {
    try {
      const key = petKey(isoDay(new Date()));
      const existing = await this.readJson<{ count: number }>(userId, key);
      await this.upsertEncrypted(userId, key, JSON.stringify({ count: (existing?.count ?? 0) + 1 }));
      await this.prune();
    } catch (error) {
      logger.warn('MemoryService.recordPet failed', error);
    }
  }

  async recordPeriod(userId: string, date: string): Promise<void> {
    try {
      await this.upsertEncrypted(userId, periodKey(), JSON.stringify({ date }), new Date(date));
      await this.prune();
    } catch (error) {
      logger.warn('MemoryService.recordPeriod failed', error);
    }
  }

  async recordPeriodPrediction(userId: string, daysUntil: number): Promise<void> {
    try {
      await this.upsertEncrypted(
        userId,
        periodPredictionKey(),
        JSON.stringify({ predictedOn: isoDay(new Date()), daysUntil }),
      );
    } catch (error) {
      logger.warn('MemoryService.recordPeriodPrediction failed', error);
    }
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------
  async getHabitAverage(userId: string, type: HabitType): Promise<number | undefined> {
    const snapshot = await this.getContextSnapshot(userId);
    return snapshot.habitAverages[type];
  }

  async getContextSnapshot(userId: string): Promise<MemoryContext> {
    const db = getDb();
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    const habitRows = await db
      .select()
      .from(companionMemory)
      .where(and(like(companionMemory.key, 'habit.%'), gte(companionMemory.created_at, windowStart)));

    const perType: Record<string, { values: number[]; days: string[]; hours: number[] }> = {};
    for (const row of habitRows) {
      const [prefix, type, day] = row.key.split('.');
      if (prefix !== 'habit' || !type || !day) continue;
      const plain = await memoryCrypto.decrypt(userId, row.value);
      if (!plain) continue;
      try {
        const parsed = JSON.parse(plain) as { value?: number };
        if (typeof parsed.value !== 'number') continue;
        perType[type] ??= { values: [], days: [], hours: [] };
        perType[type].values.push(parsed.value);
        perType[type].days.push(day);
        perType[type].hours.push(new Date(row.created_at).getHours());
      } catch {
        // unreadable value — skip
      }
    }

    const habitAverages: Partial<Record<HabitType, number>> = {};
    const frequentLogTypes: HabitType[] = [];
    const streaks: Record<HabitType, number> = {
      sleep: 0,
      water: 0,
      food: 0,
      exercise: 0,
      medication: 0,
    };
    let sleepAverageHour: number | undefined;

    for (const type of HABIT_TYPES) {
      const data = perType[type];
      if (!data || data.values.length === 0) continue;
      habitAverages[type] = average(data.values);
      if (new Set(data.days).size >= MIN_SAMPLES) frequentLogTypes.push(type);
      streaks[type] = computeStreak(new Set(data.days));
      if (type === 'sleep' && data.hours.length > 0) {
        const shifted = data.hours.map((h) => h + (h < 5 ? 24 : 0));
        sleepAverageHour = (average(shifted) % 24 + 24) % 24;
      }
    }

    const petRows = await db
      .select()
      .from(companionMemory)
      .where(and(like(companionMemory.key, 'pref.pet.%'), gte(companionMemory.created_at, windowStart)));
    let petCount = 0;
    for (const row of petRows) {
      const plain = await memoryCrypto.decrypt(userId, row.value);
      if (!plain) continue;
      try {
        const parsed = JSON.parse(plain) as { count?: number };
        petCount += typeof parsed.count === 'number' ? parsed.count : 0;
      } catch {
        // skip
      }
    }

    const moodHistory = await this.loadMoodHistory(userId);
    const moodTrend = computeMoodTrend(moodHistory);
    const weekOverWeekMood = await this.loadWeekOverWeek(userId);
    const cycle = await this.loadCycleState(userId, now);
    const meta = await companionLocalService.getMetadata(userId);

    return {
      habitAverages,
      frequentLogTypes,
      streaks,
      sleepAverageHour,
      petCount,
      moodHistory,
      moodTrend,
      weekOverWeekMood,
      lastPeriodDate: cycle.lastPeriodDate,
      daysSinceLastPeriod: cycle.daysSinceLastPeriod,
      daysUntilNextPeriod: cycle.daysUntilNextPeriod,
      relationshipLevel: meta?.relationship_level ?? 1,
      lastSeenAt: meta?.last_seen_at ?? null,
      daysSinceLastSeen:
        meta?.last_seen_at != null ? Math.floor((now - meta.last_seen_at) / MS_PER_DAY) : null,
    };
  }

  // -------------------------------------------------------------------------
  // Pruning (luna2phase2 §1.1a): 60-day TTL + 1000-row cap, aggregates kept
  // -------------------------------------------------------------------------
  async prune(): Promise<number> {
    const db = getDb();
    let removed = 0;

    const ttlCutoff = Date.now() - TTL_MS;
    const expired = await db
      .select({ key: companionMemory.key })
      .from(companionMemory)
      .where(and(lte(companionMemory.created_at, ttlCutoff), sql`(${companionMemory.key} LIKE 'habit.%' OR ${companionMemory.key} LIKE 'pref.pet.%')`));
    if (expired.length > 0) {
      removed += await this.deleteByKeys(expired.map((r) => r.key));
    }

    const total = await db.select({ count: sql<number>`count(*)` }).from(companionMemory);
    const count = Number(total[0]?.count ?? 0);
    if (count > MAX_ROWS) {
      const excess = count - MAX_ROWS;
      const oldest = await db
        .select({ key: companionMemory.key })
        .from(companionMemory)
        .where(sql`(${companionMemory.key} LIKE 'habit.%' OR ${companionMemory.key} LIKE 'pref.pet.%')`)
        .orderBy(asc(companionMemory.created_at))
        .limit(excess);
      if (oldest.length > 0) {
        removed += await this.deleteByKeys(oldest.map((r) => r.key));
      }
    }
    return removed;
  }

  // -------------------------------------------------------------------------
  // Hydration — load persisted memory into the store before first dialogue
  // -------------------------------------------------------------------------
  async hydrateMemory(userId: string): Promise<MemoryContext> {
    const snapshot = await this.getContextSnapshot(userId);
    const store = useCompanionStore.getState();
    if (snapshot.moodHistory.length > 0) {
      await store.updateMemory('moodHistory', snapshot.moodHistory);
    }
    await companionLocalService.updateLastSeen(userId);
    store.setLastSeen(Date.now());
    return snapshot;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------
  private async deleteByKeys(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const db = getDb();
    const CHUNK = 500;
    for (let i = 0; i < keys.length; i += CHUNK) {
      await db
        .delete(companionMemory)
        .where(inArray(companionMemory.key, keys.slice(i, i + CHUNK)));
    }
    return keys.length;
  }

  private async getRow(key: string) {
    const db = getDb();
    const rows = await db
      .select()
      .from(companionMemory)
      .where(eq(companionMemory.key, key))
      .limit(1);
    return rows[0] ?? null;
  }

  private async readJson<T>(userId: string, key: string): Promise<T | null> {
    const row = await this.getRow(key);
    if (!row) return null;
    const plain = await memoryCrypto.decrypt(userId, row.value);
    if (!plain) return null;
    try {
      return JSON.parse(plain) as T;
    } catch {
      return null;
    }
  }

  private async upsertEncrypted(
    userId: string,
    key: string,
    json: string,
    createdAt?: Date,
  ): Promise<void> {
    const encrypted = await memoryCrypto.encrypt(userId, json);
    const db = getDb();
    await db
      .insert(companionMemory)
      .values({ key, value: encrypted, created_at: createdAt?.getTime() ?? Date.now(), updated_at: Date.now() })
      .onConflictDoUpdate({
        target: companionMemory.key,
        set: { value: encrypted, updated_at: Date.now() },
      });
  }

  private async loadMoodHistory(userId: string): Promise<Mood[]> {
    const data = await this.readJson<unknown[]>(userId, moodHistoryKey());
    if (!Array.isArray(data)) return [];
    return data.filter((m): m is Mood => typeof m === 'string' && MOODS.includes(m as Mood));
  }

  private async loadWeekOverWeek(userId: string): Promise<number | null> {
    const db = getDb();
    const rows = await db
      .select({ key: companionMemory.key, value: companionMemory.value })
      .from(companionMemory)
      .where(like(companionMemory.key, 'mood.week_aggregate.%'))
      .orderBy(desc(companionMemory.key))
      .limit(2);
    const averages: number[] = [];
    for (const row of rows) {
      const plain = await memoryCrypto.decrypt(userId, row.value);
      if (!plain) continue;
      try {
        const parsed = JSON.parse(plain) as { total: number; count: number };
        if (parsed.count > 0) averages.push(parsed.total / parsed.count);
      } catch {
        // skip
      }
    }
    if (averages.length < 2) return null;
    return averages[0] - averages[1];
  }

  private async loadCycleState(userId: string, now: number) {
    const period = await this.readJson<{ date: string }>(userId, periodKey());
    const pred = await this.readJson<{ predictedOn: string; daysUntil: number }>(
      userId,
      periodPredictionKey(),
    );
    let lastPeriodDate: string | null = period?.date ?? null;
    let daysSinceLastPeriod: number | null = null;
    if (lastPeriodDate) {
      daysSinceLastPeriod = Math.floor((now - Date.parse(lastPeriodDate)) / MS_PER_DAY);
    }
    let daysUntilNextPeriod: number | null = null;
    if (pred && pred.predictedOn && typeof pred.daysUntil === 'number') {
      const predictedDate = new Date(pred.predictedOn);
      predictedDate.setDate(predictedDate.getDate() + pred.daysUntil);
      daysUntilNextPeriod = Math.ceil((predictedDate.getTime() - now) / MS_PER_DAY);
    }
    return { lastPeriodDate, daysSinceLastPeriod, daysUntilNextPeriod };
  }
}

export const memoryService = new MemoryService();

/**
 * Write-through bridge (luna2/rules.md §2.1): the companion module subscribes
 * to health/cycle/luna events on the event bus and records memory idempotently
 * (per-day keys → last-write-wins, so duplicate events never double-count).
 */
export function initMemoryService(): () => void {
  const unsubscribers: (() => void)[] = [];

  const record = (fn: () => Promise<void>) => {
    fn().catch(() => {
      // silent — memory must never break the app
    });
  };

  unsubscribers.push(
    eventBus.on('sleep_logged', (p) => record(() => memoryService.recordHabit(p.userId, 'sleep', p.hours))),
    eventBus.on('water_logged', (p) => record(() => memoryService.recordHabit(p.userId, 'water', p.amount))),
    eventBus.on('food_logged', (p) => record(() => memoryService.recordHabit(p.userId, 'food', 1))),
    eventBus.on('exercise_logged', (p) => record(() => memoryService.recordHabit(p.userId, 'exercise', p.duration))),
    eventBus.on('exercise_completed', (p) => record(() => memoryService.recordHabit(p.userId, 'exercise', p.duration))),
    eventBus.on('medication_logged', (p) => record(() => memoryService.recordHabit(p.userId, 'medication', p.taken ? 1 : 0))),
    eventBus.on('mood_logged', (p) => record(() => memoryService.recordMood(p.userId, (MOODS.includes(p.mood as Mood) ? p.mood : 'neutral') as Mood))),
    eventBus.on('period_logged', (p) => record(() => memoryService.recordPeriod(p.userId, p.date))),
    eventBus.on('period_approaching', (p) => record(() => memoryService.recordPeriodPrediction(p.userId, p.daysUntil))),
    eventBus.on('luna_petted', (p) => record(() => memoryService.recordPet(p.userId))),
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

export { isRawKey };
