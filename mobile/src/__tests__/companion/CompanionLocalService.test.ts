import { companionLocalService } from '../../services/localDb/CompanionLocalService';

describe('CompanionLocalService (integration)', () => {
  const USER_ID = 'test-user-companion';

  beforeEach(async () => {
    try {
      const db = (await import('../../db/connection')).getDb();
      const { companionMetadata } = await import('../../db/schema');
      const { eq } = await import('drizzle-orm');
      await db.delete(companionMetadata).where(eq(companionMetadata.user_id, USER_ID));
    } catch {}
  });

  it('creates metadata on first upsert', async () => {
    await companionLocalService.upsertMetadata({
      user_id: USER_ID,
      xp: 0,
      coins: 0,
      level: 1,
      owned_outfits: [],
      memory: {},
      is_hidden: false,
      reduce_animations: false,
      mute_sounds: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const meta = await companionLocalService.getMetadata(USER_ID);
    expect(meta).not.toBeNull();
    expect(meta?.xp).toBe(0);
  });

  it('addXP increments XP', async () => {
    await companionLocalService.addXP(USER_ID, 10);
    const meta = await companionLocalService.getMetadata(USER_ID);
    expect(meta?.xp).toBe(10);
    expect(meta?.level).toBe(1);
  });

  it('addXP triggers level up at threshold', async () => {
    await companionLocalService.addXP(USER_ID, 500);
    const meta = await companionLocalService.getMetadata(USER_ID);
    expect(meta?.level).toBe(5);
  });

  it('addCoins increments coins', async () => {
    await companionLocalService.addCoins(USER_ID, 5);
    const meta = await companionLocalService.getMetadata(USER_ID);
    expect(meta?.coins).toBe(5);
  });

  it('updateSetting persists changes', async () => {
    await companionLocalService.updateSetting(USER_ID, 'is_hidden', true);
    const meta = await companionLocalService.getMetadata(USER_ID);
    expect(meta?.is_hidden).toBe(true);
  });
});
