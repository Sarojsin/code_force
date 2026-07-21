import { getDb } from '../../db/connection';
import { sosAlerts } from '../../db/schema';
import type { SosAlert } from '../../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class SosAlertLocalService extends BaseLocalService<SosAlert> {
  protected table = sosAlerts;
  protected tableName = 'sos_alerts';

  async getByUser(userId: string): Promise<SosAlert[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(sosAlerts)
        .where(and(eq(sosAlerts.user_id, userId), eq(sosAlerts.is_active, true)))
        .orderBy(desc(sosAlerts.triggered_at))) as SosAlert[];
    } catch (error) {
      this.handleError('getByUser', error);
      return [];
    }
  }
}
