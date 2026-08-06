const mockState: Record<string, any> = {};
const mockCalls: string[] = [];

function resetMockState() {
  mockCalls.length = 0;
  Object.assign(mockState, {
    userId: 'smoke-test-user',
    xp: 100,
    coins: 50,
    level: 1,
    isHidden: false,
    isHydrated: true,
    installStatus: 'ready',
    addXP: (amount: number) => { mockCalls.push(`addXP(${amount})`); return Promise.resolve(); },
    addCoins: (amount: number) => { mockCalls.push(`addCoins(${amount})`); return Promise.resolve(); },
    updateMemory: () => { mockCalls.push('updateMemory'); return Promise.resolve(); },
  });
}

resetMockState();

jest.mock('../../stores/companionStore', () => {
  const st = {
    getState: () => mockState,
    setState: (s: any) => Object.assign(mockState, s),
    subscribe: () => () => {},
    destroy: () => {},
  };
  return {
    useCompanionStore: st,
    XP_REWARDS: { journal_saved: 10, mood_logged: 5, water_logged: 3, exercise_completed: 8, period_logged: 15, period_corrected: 5, daily_login: 2, diary_page_created: 12, diary_photo_added: 5, diary_page_saved: 5, diary_opened: 2, diary_media_synced: 8, day_logged: 4 },
    COIN_REWARDS: { journal_saved: 2, mood_logged: 1, water_logged: 1, exercise_completed: 2, period_logged: 3, period_corrected: 1, daily_login: 1, diary_page_created: 2, diary_photo_added: 1, diary_page_saved: 1, diary_media_synced: 2, day_logged: 1 },
    calculateLevel: (_xp: number) => 1,
    getLevelTitle: () => 'Kitten',
    xpToNextLevel: () => 500,
  };
});

jest.mock('../../services/companion/DialogueEngine', () => ({
  dialogueEngine: {
    get: jest.fn(() => 'Test dialogue'),
    isLoaded: true,
    getWelcomeBack: jest.fn(() => 'Welcome back!'),
  },
}));

import { eventBus } from '../../services/eventBus';
import { initEventEngine } from '../../services/companion/EventEngine';
import { emitDiaryPageCreated, emitDiaryMediaSynced } from '../../services/diary/diaryEvents';

describe('Luna Event Flow (smoke)', () => {
  let cleanup: (() => void) | null = null;
  const showBubbleMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockState();
  });

  afterEach(() => {
    cleanup?.();
    eventBus.clear();
  });

  it('journal_saved calls addXP and showBubble', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('journal_saved', {
      userId: 'smoke-test-user',
      journalId: 'j-smoke-1',
    });

    expect(mockCalls).toContain('addXP(10)');
    expect(mockCalls).toContain('addCoins(2)');
    expect(showBubbleMock).toHaveBeenCalledWith(
      'Test dialogue',
      'happy',
      3000
    );
  });

  it('period_logged calls addXP and showBubble', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('period_logged', {
      userId: 'smoke-test-user',
      cycleEntryId: 'c-smoke-1',
      date: '2026-07-25',
    });

    expect(mockCalls).toContain('addXP(15)');
    expect(mockCalls).toContain('addCoins(3)');
    expect(showBubbleMock).toHaveBeenCalledWith(
      'Test dialogue',
      'celebrate',
      4000
    );
  });

  it('mood_logged sad triggers sad animation', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('mood_logged', {
      userId: 'smoke-test-user',
      moodLogId: 'm-smoke-1',
      mood: 'sad',
      intensity: 4,
    });

    expect(mockCalls).toContain('addXP(5)');
    expect(showBubbleMock).toHaveBeenCalledWith(
      "I'm here for you. Let's take a moment together",
      'sad',
      4000
    );
  });

  it('does not respond when hidden', () => {
    mockState.isHidden = true;
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('journal_saved', {
      userId: 'smoke-test-user',
      journalId: 'j-smoke-1',
    });

    expect(mockCalls).toEqual([]);
    expect(showBubbleMock).not.toHaveBeenCalled();
  });

  it('water_logged triggers reaction', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('water_logged', {
      userId: 'smoke-test-user',
      amount: 500,
    });

    expect(showBubbleMock).toHaveBeenCalled();
    const call = showBubbleMock.mock.calls[0];
    expect(call[0]).toBeTruthy();
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

  it('diary_page_created triggers happy + XP', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('diary_page_created', {
      userId: 'smoke-test-user',
      diaryId: 'd-smoke-1',
      pageId: 'p-smoke-1',
      page_date: '2026-08-06',
    });

    expect(mockCalls).toContain('addXP(12)');
    expect(mockCalls).toContain('addCoins(2)');
    expect(showBubbleMock).toHaveBeenCalledWith('Test dialogue', 'happy', 3500);
  });

  it('diary_photo_added triggers wave + XP', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('diary_photo_added', {
      userId: 'smoke-test-user',
      mediaId: 'media-smoke-1',
      mimeType: 'image/jpeg',
    });

    expect(mockCalls).toContain('addXP(5)');
    expect(showBubbleMock).toHaveBeenCalledWith('Test dialogue', 'wave', 3000);
  });

  it('diary_page_saved triggers idle + XP', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('diary_page_saved', {
      userId: 'smoke-test-user',
      diaryId: 'd-smoke-1',
      pageId: 'p-smoke-1',
    });

    expect(mockCalls).toContain('addXP(5)');
    expect(showBubbleMock).toHaveBeenCalledWith('Test dialogue', 'idle', 3000);
  });

  it('diary_opened triggers idle + small XP', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('diary_opened', {
      userId: 'smoke-test-user',
      diaryId: 'd-smoke-1',
      pageId: 'p-smoke-1',
    });

    expect(mockCalls).toContain('addXP(2)');
    expect(showBubbleMock).toHaveBeenCalledWith('Test dialogue', 'idle', 3000);
  });

  it('diary_media_synced triggers happy + XP bonus', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('diary_media_synced', {
      userId: 'smoke-test-user',
      mediaId: 'media-smoke-1',
      s3Key: 'k',
    });

    expect(mockCalls).toContain('addXP(8)');
    expect(mockCalls).toContain('addCoins(2)');
    expect(showBubbleMock).toHaveBeenCalledWith('Test dialogue', 'happy', 3000);
  });

  it('day_logged triggers mood reflection reaction', () => {
    cleanup = initEventEngine(showBubbleMock);

    eventBus.emit('day_logged', {
      userId: 'smoke-test-user',
      logDate: '2026-08-06',
      mood: 'calm',
      moodIntensity: 3,
    });

    expect(mockCalls).toContain('addXP(4)');
    expect(mockCalls).toContain('addCoins(1)');
    expect(showBubbleMock).toHaveBeenCalledWith('Test dialogue', 'happy', 3000);
  });

  it('diary events are ignored without crash when companion not installed', () => {
    mockState.installStatus = 'none';
    cleanup = initEventEngine(showBubbleMock);

    expect(() => {
      eventBus.emit('diary_page_created', {
        userId: 'smoke-test-user',
        diaryId: 'd-smoke-1',
        pageId: 'p-smoke-1',
        page_date: '2026-08-06',
      });
    }).not.toThrow();

    expect(mockCalls).toEqual([]);
    expect(showBubbleMock).not.toHaveBeenCalled();
  });

  it('full event-bus flow: diary service emit → EventEngine reaction → bubble + XP', () => {
    cleanup = initEventEngine(showBubbleMock);

    emitDiaryPageCreated({
      userId: 'smoke-test-user',
      diaryId: 'd-smoke-1',
      pageId: 'p-smoke-1',
      page_date: '2026-08-06',
    });

    expect(mockCalls).toContain('addXP(12)');
    expect(showBubbleMock).toHaveBeenCalledWith('Test dialogue', 'happy', 3500);

    showBubbleMock.mockClear();
    mockCalls.length = 0;

    emitDiaryMediaSynced({ userId: 'smoke-test-user', mediaId: 'media-smoke-1', s3Key: 'k' });

    expect(mockCalls).toContain('addXP(8)');
    expect(showBubbleMock).toHaveBeenCalledWith('Test dialogue', 'happy', 3000);
  });

  it('cleanup removes all listeners', () => {
    cleanup = initEventEngine(showBubbleMock);
    cleanup();
    cleanup = null;

    expect(eventBus.listenerCount('journal_saved')).toBe(0);
    expect(eventBus.listenerCount('mood_logged')).toBe(0);
    expect(eventBus.listenerCount('period_logged')).toBe(0);
  });
});
