// dialogueMemory.test.ts — memory-aware dialogue context resolution

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readAsStringAsync: jest.fn(async () => '{}'),
}));

import { dialogueEngine, resolveMemoryDialogue } from '../../services/companion/DialogueEngine';
import type { MemoryContext } from '../../services/companion/memoryService';

function baseContext(overrides: Partial<MemoryContext> = {}): MemoryContext {
  return {
    habitAverages: {},
    frequentLogTypes: [],
    streaks: { sleep: 0, water: 0, food: 0, exercise: 0, medication: 0 },
    sleepAverageHour: undefined,
    petCount: 0,
    moodHistory: [],
    moodTrend: null,
    weekOverWeekMood: null,
    lastPeriodDate: null,
    daysSinceLastPeriod: null,
    daysUntilNextPeriod: null,
    relationshipLevel: 1,
    lastSeenAt: null,
    daysSinceLastSeen: null,
    ...overrides,
  };
}

describe('resolveMemoryDialogue', () => {
  it('sleep-aware: wind-down tip after >=3 consistent samples of late sleep', () => {
    const memory = baseContext({ frequentLogTypes: ['sleep'], sleepAverageHour: 23 });
    expect(resolveMemoryDialogue('late_night', memory)).toBe('memory_sleep_late');
  });

  it('does not nag when sleep samples are too few', () => {
    const memory = baseContext({ frequentLogTypes: [], sleepAverageHour: 23 });
    expect(resolveMemoryDialogue('late_night', memory)).toBeNull();
  });

  it('water-aware: hydration hero above the daily threshold', () => {
    const memory = baseContext({ habitAverages: { water: 8 } });
    expect(resolveMemoryDialogue('water', memory)).toBe('memory_water_hero');
  });

  it('exercise streak-aware', () => {
    const memory = baseContext({ streaks: { sleep: 0, water: 0, food: 0, exercise: 3, medication: 0 } });
    expect(resolveMemoryDialogue('exercise', memory)).toBe('memory_streak');
  });

  it('medication consistency-aware', () => {
    const memory = baseContext({ streaks: { sleep: 0, water: 0, food: 0, exercise: 0, medication: 4 } });
    expect(resolveMemoryDialogue('medication', memory)).toBe('memory_medication_consistent');
  });

  it('cycle-aware: empathy pool when period expected within 3 days', () => {
    const memory = baseContext({ daysUntilNextPeriod: 2 });
    expect(resolveMemoryDialogue('period_approaching', memory)).toBe('memory_period_due');
  });

  it('cycle-aware: no special pool when period is far away', () => {
    const memory = baseContext({ daysUntilNextPeriod: 12 });
    expect(resolveMemoryDialogue('period_approaching', memory)).toBeNull();
  });

  it('mood recall: declining trend + sad mood + enough history', () => {
    const memory = baseContext({
      moodHistory: ['sad', 'sad', 'neutral'],
      moodTrend: 'declining',
    });
    expect(resolveMemoryDialogue('mood_logged', memory, 'sad')).toBe('memory_mood_recall');
  });

  it('mood recall: not for happy moods', () => {
    const memory = baseContext({
      moodHistory: ['sad', 'sad', 'neutral'],
      moodTrend: 'declining',
    });
    expect(resolveMemoryDialogue('mood_logged', memory, 'happy')).toBeNull();
  });

  it('welcome-back: acknowledges time away', () => {
    const memory = baseContext({ daysSinceLastSeen: 4 });
    expect(resolveMemoryDialogue('welcome_back', memory)).toBe('memory_welcome_missed');
  });

  it('welcome-back: normal pool for daily returns', () => {
    const memory = baseContext({ daysSinceLastSeen: 0 });
    expect(resolveMemoryDialogue('welcome_back', memory)).toBeNull();
  });

  it('ignores unrelated contexts', () => {
    const memory = baseContext({ habitAverages: { water: 9 } });
    expect(resolveMemoryDialogue('journal_saved', memory)).toBeNull();
  });
});

describe('DialogueEngine memory-aware get()', () => {
  afterEach(() => {
    dialogueEngine.setMemoryContext(null);
  });

  it('picks the memory pool when memory context matches', () => {
    dialogueEngine.setMemoryContext(baseContext({ frequentLogTypes: ['sleep'], sleepAverageHour: 23 }));
    const text = dialogueEngine.get('late_night');
    expect(dialogueEngine.getAll('memory_sleep_late')).toContain(text);
  });

  it('falls back to static pools without a memory snapshot', () => {
    const text = dialogueEngine.get('welcome_back');
    expect([
      'Welcome back! I was waiting for you!',
      'I missed you! So glad to see you again!',
    ]).toContain(text);
  });

  it('memory pools are bundled (available offline via fallback)', () => {
    for (const key of [
      'memory_sleep_late',
      'memory_water_hero',
      'memory_streak',
      'memory_medication_consistent',
      'memory_period_due',
      'memory_mood_recall',
      'memory_welcome_missed',
    ]) {
      expect(dialogueEngine.getAll(key).length).toBeGreaterThan(0);
    }
  });
});
