# Phase 2 Day 13 — Integration Tests

## Goal
Write integration tests for all new Phase 2 services: `HealthMetricsLocalService`, `healthMetricsStore`, `MoodManager`, `AchievementEngine`, `SoundEngine` (mocked), `healthTips` service, and the updated `EventEngine` health reactions.

---

## 13.1 Test Setup Notes

### Mock strategies

| Dependency | Mock Strategy |
|------------|---------------|
| `expo-av` (Audio) | Full module mock — `jest.mock('expo-av')` |
| `HealthMetricsLocalService` | Real instance against test SQLite (same pattern as `BaseLocalService.test.ts`) |
| `apiClient` for healthTips | Mock with `jest.mock('../../api/client')` |
| `SoundEngine` | Mock `soundEngine.playForAnimation` as no-op |
| `companionStore` | Mock via `jest.mock('../../stores/companionStore')` with inline state object |

### New mock factories

```typescript
// __mocks__/expo-av.ts
export const Audio = {
  Sound: jest.fn().mockImplementation(() => ({
    loadAsync: jest.fn().mockResolvedValue(undefined),
    replayAsync: jest.fn().mockResolvedValue(undefined),
    unloadAsync: jest.fn().mockResolvedValue(undefined),
  })),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
};
```

---

## 13.2 Create `src/__tests__/companion/HealthMetricsLocalService.test.ts`

```typescript
import { HealthMetricsLocalService } from '../../services/localDb/HealthMetricsLocalService';

// Note: Requires SQLite test DB setup similar to BaseLocalService.test.ts
// For now, mark as integration test (manual run only):
describe('HealthMetricsLocalService (integration)', () => {
  const service = new HealthMetricsLocalService();

  beforeAll(async () => {
    // Run the migration in a temp DB
  });

  it('logMetric inserts a row', async () => {
    await service.logMetric('user-1', 'sleep', { hours: 8, quality: 4 });
    const today = await service.getToday('user-1');
    expect(today.length).toBeGreaterThan(0);
    expect(today[0].metric_type).toBe('sleep');
  });

  it('getToday returns only today entries', async () => {
    const rows = await service.getToday('user-1');
    rows.forEach((r) => {
      const loggedDate = r.logged_at.split('T')[0];
      expect(loggedDate).toBe(new Date().toISOString().split('T')[0]);
    });
  });

  it('getStreak returns 0 for no logs', async () => {
    const streak = await service.getStreak('user-2', 'water');
    expect(streak).toBe(0);
  });

  it('getTodayCompletion returns count', async () => {
    const completion = await service.getTodayCompletion('user-1');
    expect(completion.total).toBe(5);
    expect(completion.logged.length).toBeGreaterThanOrEqual(1);
  });
});
```

---

## 13.3 Create `src/__tests__/companion/MoodManager.test.ts`

```typescript
import { moodManager } from '../../services/companion/MoodManager';

describe('MoodManager', () => {
  beforeEach(() => {
    moodManager.reset();
  });

  it('returns stable with < 3 entries', () => {
    expect(moodManager.addMood('happy')).toBe('stable');
    expect(moodManager.addMood('happy')).toBe('stable');
  });

  it('returns improving when mood scores rise', () => {
    moodManager.addMood('sad');   // 2
    moodManager.addMood('neutral'); // 5
    moodManager.addMood('happy'); // 10
    expect(moodManager.addMood('happy')).toBe('improving');
  });

  it('returns declining when mood scores drop', () => {
    moodManager.addMood('happy');  // 10
    moodManager.addMood('neutral'); // 5
    moodManager.addMood('sad');    // 2
    expect(moodManager.addMood('sad')).toBe('declining');
  });

  it('returns volatile with large swings', () => {
    moodManager.addMood('happy'); // 10
    moodManager.addMood('angry'); // 1
    moodManager.addMood('happy'); // 10
    expect(moodManager.addMood('angry')).toBe('volatile');
  });

  it('returns recommendation for sad', () => {
    const rec = moodManager.getRecommendation('sad');
    expect(rec).toContain("I'm here for you");
  });

  it('returns null for happy', () => {
    expect(moodManager.getRecommendation('happy')).toBeNull();
  });

  it('getHistory returns copy', () => {
    moodManager.addMood('happy');
    expect(moodManager.getHistory()).toEqual(['happy']);
  });
});
```

---

## 13.4 Create `src/__tests__/companion/AchievementEngine.test.ts`

```typescript
import { achievementEngine, ACHIEVEMENTS } from '../../services/companion/AchievementEngine';

// Mock the healthMetricsLocalService getStreak calls
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

jest.mock('../../stores/companionStore', () => {
  const mockMemory: Record<string, any> = {};
  const mockStore = {
    getState: () => ({
      userId: 'test-user',
      memory: { achievements: [] },
      updateMemory: jest.fn(),
    }),
  };
  return {
    companionStore: mockStore,
    useCompanionStore: mockStore,
  };
});

describe('AchievementEngine', () => {
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
    // sleep_streak_7 should be unlocked (sleepStreak mock returns 7)
    const sleepAch = result.find((a) => a.id === 'sleep_streak_7');
    expect(sleepAch).toBeDefined();
  });

  it('skips already unlocked achievements', async () => {
    jest.spyOn(require('../../stores/companionStore').useCompanionStore, 'getState')
      .mockReturnValue({
        userId: 'test-user',
        memory: { achievements: ['sleep_streak_7'] },
        updateMemory: jest.fn(),
      });

    const result = await achievementEngine.checkAchievements('test-user');
    const sleepAch = result.find((a) => a.id === 'sleep_streak_7');
    expect(sleepAch).toBeUndefined();
  });
});
```

---

## 13.5 Create `src/__tests__/companion/healthTips.test.ts`

```typescript
import { getHealthTip, getFallbackTip, getDailyTips } from '../../services/healthTips';

jest.mock('../../api/client', () => ({
  apiClient: {
    get: jest.fn().mockRejectedValue(new Error('Network error')),
  },
}));

describe('healthTips', () => {
  it('getFallbackTip returns a tip from bundled JSON', () => {
    const tip = getFallbackTip('sleep');
    expect(tip).toBeTruthy();
    expect(typeof tip).toBe('string');
  });

  it('getFallbackTip returns null for unknown category', () => {
    expect(getFallbackTip('invalid' as any)).toBeNull();
  });

  it('getHealthTip falls back when API fails', async () => {
    const tip = await getHealthTip('water');
    expect(tip).toBeTruthy();
  });

  it('getDailyTips returns max 3', async () => {
    const tips = await getDailyTips();
    expect(tips.length).toBeLessThanOrEqual(3);
  });
});
```

---

## 13.6 Update `eventFlow.test.ts` — Add Health Event Tests

Add to the existing `eventFlow.test.ts`:

```typescript
it('water_logged triggers reaction', () => {
  cleanup = initEventEngine(showBubbleMock);

  eventBus.emit('water_logged', {
    userId: 'smoke-test-user',
    amount: 500,
  });

  expect(showBubbleMock).toHaveBeenCalled();
  // Verify it uses 'wave' animation for water
  const call = showBubbleMock.mock.calls[0];
  expect(call[0]).toBeTruthy(); // has dialogue
  expect(call[1]).toBe('wave');
  expect(call[2]).toBe(3000);
});

it('exercise_completed triggers celebration', () => {
  cleanup = initEventEngine(showBubbleMock);

  eventBus.emit('exercise_completed', {
    userId: 'smoke-test-user',
    type: 'walking',
    duration: 25,
  });

  expect(showBubbleMock).toHaveBeenCalled();
  const call = showBubbleMock.mock.calls[0];
  expect(call[1]).toBe('celebrate');
  expect(call[2]).toBe(3500);
});
```

---

## 13.7 Validation

- [ ] `HealthMetricsLocalService` tests pass (with SQLite test DB)
- [ ] `MoodManager` tests pass (8 test cases)
- [ ] `AchievementEngine` tests pass (5 test cases)
- [ ] `healthTips` tests pass (4 test cases, all use fallback)
- [ ] `eventFlow.test.ts` passes with new health event tests
- [ ] All tests pass with `--no-coverage` flag
- [ ] `tsc --noEmit` passes with 0 new errors
