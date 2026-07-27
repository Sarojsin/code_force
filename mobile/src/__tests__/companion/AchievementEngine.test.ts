jest.mock('../../services/localDb', () => ({
  healthMetricsLocalService: {
    getStreak: jest.fn().mockImplementation(
      (_userId: string, type: string) => {
        if (type === 'sleep') return Promise.resolve(7);
        if (type === 'water') return Promise.resolve(3);
        return Promise.resolve(0);
      }
    ),
  },
}));

const mockMemory: Record<string, any> = { achievements: [] };
const mockStore = {
  getState: () => ({
    userId: 'test-user',
    memory: mockMemory,
    updateMemory: jest.fn(),
  }),
};

jest.mock('../../stores/companionStore', () => ({
  useCompanionStore: mockStore,
}));

import { achievementEngine, ACHIEVEMENTS } from '../../services/companion/AchievementEngine';

describe('AchievementEngine', () => {
  beforeEach(() => {
    mockMemory.achievements = [];
  });

  it('ACHIEVEMENTS has at least 7 entries', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(7);
  });

  it('sleep_streak_7 unlocks with sleepStreak >= 7', () => {
    const ach = ACHIEVEMENTS.find((a) => a.id === 'sleep_streak_7');
    expect(ach).toBeDefined();
    expect(ach!.condition({ sleepStreak: 7, waterStreak: 0, foodStreak: 0, exerciseStreak: 0, medicationStreak: 0 })).toBe(true);
  });

  it('sleep_streak_7 stays locked with sleepStreak < 7', () => {
    const ach = ACHIEVEMENTS.find((a) => a.id === 'sleep_streak_7');
    expect(ach!.condition({ sleepStreak: 3, waterStreak: 0, foodStreak: 0, exerciseStreak: 0, medicationStreak: 0 })).toBe(false);
  });

  it('checkAchievements returns newly unlocked achievements only', async () => {
    const result = await achievementEngine.checkAchievements('test-user');
    const sleepAch = result.find((a) => a.id === 'sleep_streak_7');
    expect(sleepAch).toBeDefined();
  });

  it('skips already unlocked achievements', async () => {
    mockMemory.achievements = ['sleep_streak_7'];
    const result = await achievementEngine.checkAchievements('test-user');
    const sleepAch = result.find((a) => a.id === 'sleep_streak_7');
    expect(sleepAch).toBeUndefined();
  });
});
