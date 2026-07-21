import { getDb } from '../../db/connection';
import { familyLinks } from '../../db/schema';
import type { FamilyLink } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class FamilyLinkLocalService extends BaseLocalService<FamilyLink> {
  protected table = familyLinks;
  protected tableName = 'family_links';

  async getByUser(userId: string): Promise<FamilyLink[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(familyLinks)
        .where(and(eq(familyLinks.user_id, userId), eq(familyLinks.is_active, true)))) as FamilyLink[];
    } catch (error) {
      this.handleError('getByUser', error);
      return [];
    }
  }

  async getByStatus(userId: string, status: string): Promise<FamilyLink[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(familyLinks)
        .where(
          and(
            eq(familyLinks.user_id, userId),
            eq(familyLinks.status, status),
            eq(familyLinks.is_active, true)
          )
        )) as FamilyLink[];
    } catch (error) {
      this.handleError('getByStatus', error);
      return [];
    }
  }
}
