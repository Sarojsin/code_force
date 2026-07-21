import { getDb } from '../../db/connection';
import { emergencyContacts } from '../../db/schema';
import type { EmergencyContact } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class EmergencyContactLocalService extends BaseLocalService<EmergencyContact> {
  protected table = emergencyContacts;
  protected tableName = 'emergency_contacts';

  async getByUser(userId: string): Promise<EmergencyContact[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(emergencyContacts)
        .where(and(eq(emergencyContacts.user_id, userId), eq(emergencyContacts.is_active, true)))
        .orderBy(emergencyContacts.is_primary)) as EmergencyContact[];
    } catch (error) {
      this.handleError('getByUser', error);
      return [];
    }
  }
}
