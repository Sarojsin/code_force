// dialogueCyclePhase.test.ts — luna2 phase5 §2 cycle-phase-aware dialogue.
// Uses the REAL DialogueEngine with an injected phase source and asserts the
// picked support pool varies by phase (follicular vs luteal vs period).

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readAsStringAsync: jest.fn(async () => '{}'),
}));

import { dialogueEngine, resolveMemoryDialogue } from '../../services/companion/DialogueEngine';
import type { CyclePhase } from '../../services/companion/DialogueEngine';

const PHASES: CyclePhase[] = ['menstrual', 'follicular', 'fertile', 'ovulation', 'luteal'];

describe('DialogueEngine cycle-phase-aware get()', () => {
  afterEach(() => {
    dialogueEngine.setCyclePhaseSource(null);
    dialogueEngine.setMemoryContext(null);
  });

  it('bundles cycle-phase support pools for every phase', () => {
    for (const phase of PHASES) {
      expect(dialogueEngine.getAll(`cycle_phase_${phase}`).length).toBeGreaterThan(0);
    }
  });

  it('bundles the new diary + day_logged dialogue pools', () => {
    for (const key of [
      'diary_page_created',
      'diary_photo_added',
      'diary_page_saved',
      'diary_opened',
      'diary_media_synced',
      'day_logged',
    ]) {
      expect(dialogueEngine.getAll(key).length).toBeGreaterThan(0);
    }
  });

  it('picks a different support pool per phase (follicular vs luteal vs period)', () => {
    dialogueEngine.setCyclePhaseSource(() => 'follicular');
    const follicular = dialogueEngine.get('period_logged');
    dialogueEngine.setCyclePhaseSource(() => 'luteal');
    const luteal = dialogueEngine.get('period_logged');
    dialogueEngine.setCyclePhaseSource(() => 'menstrual');
    const menstrual = dialogueEngine.get('period_logged');

    expect(dialogueEngine.getAll('cycle_phase_follicular')).toContain(follicular);
    expect(dialogueEngine.getAll('cycle_phase_luteal')).toContain(luteal);
    expect(dialogueEngine.getAll('cycle_phase_menstrual')).toContain(menstrual);
    expect(new Set([follicular, luteal, menstrual]).size).toBe(3);
  });

  it('day_logged uses the phase-tailored pool when a phase is available', () => {
    dialogueEngine.setCyclePhaseSource(() => 'menstrual');
    const line = dialogueEngine.get('day_logged');
    expect(dialogueEngine.getAll('cycle_phase_menstrual')).toContain(line);
  });

  it('falls back to the static pool when no phase source is injected', () => {
    const line = dialogueEngine.get('diary_opened');
    expect(dialogueEngine.getAll('diary_opened')).toContain(line);
  });

  it('non-cycle-aware contexts are not overridden by the phase pool', () => {
    dialogueEngine.setCyclePhaseSource(() => 'luteal');
    const line = dialogueEngine.get('diary_photo_added');
    expect(dialogueEngine.getAll('diary_photo_added')).toContain(line);
    expect(dialogueEngine.getAll('cycle_phase_luteal')).not.toContain(line);
  });

  it('memory resolution still wins over the phase pool', () => {
    const memory = {
      habitAverages: {},
      frequentLogTypes: [],
      streaks: { sleep: 0, water: 0, food: 0, exercise: 0, medication: 0 },
      sleepAverageHour: undefined,
      petCount: 0,
      moodHistory: ['sad', 'sad', 'neutral'],
      moodTrend: 'declining' as const,
      weekOverWeekMood: null,
      lastPeriodDate: null,
      daysSinceLastPeriod: null,
      daysUntilNextPeriod: null,
      relationshipLevel: 1,
      lastSeenAt: null,
      daysSinceLastSeen: null,
    };
    dialogueEngine.setMemoryContext(memory as any);
    dialogueEngine.setCyclePhaseSource(() => 'luteal');

    expect(resolveMemoryDialogue('mood_logged', memory as any, 'sad')).toBe('memory_mood_recall');
    expect(dialogueEngine.getAll('memory_mood_recall')).toContain(dialogueEngine.get('mood_logged', 'sad'));
  });
});
