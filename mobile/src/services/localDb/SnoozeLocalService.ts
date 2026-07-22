import { getDb } from '../../db/connection';
import { snoozeEvents } from '../../db/schema';
import type { SnoozeEvent } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class SnoozeLocalService extends BaseLocalService<SnoozeEvent> {
  protected table = snoozeEvents;
  protected tableName = 'snooze_events';

  async getLatestByPrediction(userId: string, predictedCycleId: string): Promise<SnoozeEvent | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(snoozeEvents)
        .where(and(eq(snoozeEvents.user_id, userId), eq(snoozeEvents.predicted_cycle_id, predictedCycleId)))
        .orderBy(desc(snoozeEvents.snoozed_at))
        .limit(1);
      return (result as SnoozeEvent[])[0] ?? null;
    } catch (error) {
      this.handleError('getLatestByPrediction', error);
      return null;
    }
  }
}