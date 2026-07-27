import { healthMetricsLocalService } from '../../services/localDb/HealthMetricsLocalService';

describe('HealthMetricsLocalService (integration)', () => {
  const USER_ID = 'test-user-health-metrics';

  beforeEach(async () => {
    try {
      const db = (await import('../../db/connection')).getDb();
      const { healthMetrics } = await import('../../db/schema');
      const { eq } = await import('drizzle-orm');
      await db.delete(healthMetrics).where(eq(healthMetrics.user_id, USER_ID));
    } catch {}
  });

  it('logMetric inserts a row', async () => {
    await healthMetricsLocalService.logMetric(USER_ID, 'sleep', { hours: 8, quality: 4 });
    const today = await healthMetricsLocalService.getToday(USER_ID);
    expect(today.length).toBeGreaterThan(0);
    expect(today[0].metric_type).toBe('sleep');
  });

  it('getToday returns only today entries', async () => {
    const rows = await healthMetricsLocalService.getToday(USER_ID);
    rows.forEach((r) => {
      const loggedDate = r.logged_at.split('T')[0];
      expect(loggedDate).toBe(new Date().toISOString().split('T')[0]);
    });
  });

  it('getStreak returns 0 for no logs', async () => {
    const streak = await healthMetricsLocalService.getStreak(USER_ID, 'water');
    expect(streak).toBe(0);
  });

  it('getTodayCompletion returns count', async () => {
    const completion = await healthMetricsLocalService.getTodayCompletion(USER_ID);
    expect(completion.total).toBe(5);
  });
});
