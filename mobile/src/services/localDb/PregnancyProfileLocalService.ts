import { getDb } from '../../db/connection';
import { pregnancyProfiles } from '../../db/schema';
import type { PregnancyProfile } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class PregnancyProfileLocalService extends BaseLocalService<PregnancyProfile> {
  protected table = pregnancyProfiles;
  protected tableName = 'pregnancy_profiles';

  async getByUser(userId: string): Promise<PregnancyProfile | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(pregnancyProfiles)
        .where(eq(pregnancyProfiles.user_id, userId))
        .limit(1);
      return (result as PregnancyProfile[])[0] ?? null;
    } catch (error) {
      this.handleError('getByUser', error);
      return null;
    }
  }
}
