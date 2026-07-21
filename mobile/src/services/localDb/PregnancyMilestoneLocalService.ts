import { getDb } from '../../db/connection';
import { pregnancyMilestones } from '../../db/schema';
import type { PregnancyMilestone } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class PregnancyMilestoneLocalService extends BaseLocalService<PregnancyMilestone> {
  protected table = pregnancyMilestones;
  protected tableName = 'pregnancy_milestones';

  async getByUser(userId: string): Promise<PregnancyMilestone[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(pregnancyMilestones)
        .where(eq(pregnancyMilestones.user_id, userId))
        .orderBy(pregnancyMilestones.week)) as PregnancyMilestone[];
    } catch (error) {
      this.handleError('getByUser', error);
      return [];
    }
  }
}
