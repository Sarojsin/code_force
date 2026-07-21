import { getDb } from '../../db/connection';
import { healthInsights } from '../../db/schema';
import type { HealthInsight } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class HealthInsightLocalService extends BaseLocalService<HealthInsight> {
  protected table = healthInsights;
  protected tableName = 'health_insights';

  async getByUser(userId: string): Promise<HealthInsight | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(healthInsights)
        .where(eq(healthInsights.user_id, userId))
        .limit(1);
      return (result as HealthInsight[])[0] ?? null;
    } catch (error) {
      this.handleError('getByUser', error);
      return null;
    }
  }

  async getByCategory(userId: string, category: string): Promise<HealthInsight[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(healthInsights)
        .where(
          eq(healthInsights.user_id, userId),
          sql`${healthInsights.recommendation} LIKE ${'%' + category + '%'}`
        )) as HealthInsight[];
    } catch (error) {
      this.handleError('getByCategory', error);
      return [];
    }
  }
}
