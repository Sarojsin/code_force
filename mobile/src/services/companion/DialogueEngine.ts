import * as FileSystem from 'expo-file-system/legacy';
import type { MemoryContext } from './memoryService';

const COMPANION_DIR = (FileSystem.documentDirectory ?? '') + 'companion/';
const DIALOGUES_FILE = COMPANION_DIR + 'dialogues.json';

const FALLBACK_DIALOGUES: Record<string, string[]> = {
  welcome_back: [
    'Welcome back! I was waiting for you!',
    'I missed you! So glad to see you again!',
  ],
  pet: ['Purr... that feels nice!', 'Pet me again please!'],
  memory_sleep_late: [
    "You've been logging sleep around 11pm — need a wind-down tip?",
    'I noticed you tend to sleep late. Want to try an earlier wind-down tonight?',
    'Your bedtime keeps drifting late. A small night routine could help!',
  ],
  memory_water_hero: [
    "You're turning into a hydration hero! Six glasses or more is impressive!",
    'Look at that water streak — your future self is glowing!',
    'You drink more water than most — genuinely proud of you!',
  ],
  memory_streak: [
    'Three days in a row — this habit is sticking!',
    'Your consistency is building something real. Keep going!',
    'Streak is growing! You showed up every day this week!',
  ],
  memory_medication_consistent: [
    'You have been on schedule for days — your body notices the consistency.',
    'Consistency with medication is a huge win. I am cheering for you!',
    'Medication streak intact. You are showing up for yourself!',
  ],
  memory_period_due: [
    'Your period should be close — I have got the heating pad energy ready.',
    'Period due soon. Rest, hydrate, and be gentle with yourself.',
    'I remember this feeling. You are prepared and not alone.',
  ],
  memory_mood_recall: [
    'Last time you felt this way you went for a walk. Want to try again?',
    'You have felt like this before and got through it. I remember that strength.',
    'Last time this feeling came, a little fresh air helped. Should we try it?',
  ],
  memory_welcome_missed: [
    'You were away for a while — I kept your spot warm!',
    'It has been a few days! I missed you a lot.',
    'Welcome back, stranger! I saved every purr for you.',
  ],
  diary_page_created: [
    'New page, new you! I love a fresh start.',
    'A brand new page — let us fill it with good things.',
    'I can almost smell the paper. What will we write?',
  ],
  diary_photo_added: [
    'Ooh, I saw that snapshot — beautiful!',
    'That photo caught my eye. Lovely choice.',
    'A little moment, frozen forever. Nice.',
  ],
  diary_page_saved: [
    'Saved. You showed up for yourself today.',
    'Page tucked away safely. Nicely done.',
    'Good save. That page is yours to keep.',
  ],
  diary_opened: [
    "Let's write something beautiful together.",
    'I love when you open your diary.',
    'Another page awaits. Take your time.',
  ],
  diary_media_synced: [
    'Your memory is safely backed up now.',
    'All synced — your photos are safe.',
    'Everything uploaded. Nothing lost.',
  ],
  day_logged: [
    'Feeling it today — logged it. Good job.',
    'I see you took a moment for yourself. That counts.',
    'Another day, captured. You are doing great.',
  ],
  cycle_phase_menstrual: [
    'You are in your period phase. Rest, hydrate, and be gentle with yourself.',
    'Period days are rest days. I have got the warmth covered.',
    'Be extra kind to yourself right now. Your body is working hard.',
  ],
  cycle_phase_follicular: [
    'Follicular phase — rising energy. A great time to start something new.',
    'Your energy is building. Today is good for fresh beginnings.',
    'Early-cycle glow. You have the momentum to begin.',
  ],
  cycle_phase_luteal: [
    'Luteal phase — time to wind down and nurture yourself.',
    'Late-cycle days call for softness. Protect your peace.',
    'You may feel more inward right now. That is okay.',
  ],
  cycle_phase_fertile: [
    'You are in your fertile window — energy and confidence are high.',
    'Fertile phase. A bright, magnetic stretch of days.',
    'High-vitality days. Make the most of that spark.',
  ],
  cycle_phase_ovulation: [
    'Ovulation day — peak vitality. You are radiating.',
    'Ovulation peak. You have never been more magnetic.',
    'At your peak today. Go make it count.',
  ],
};

type DialogueContext = string;

const EVENING_HOUR = 18;
const MORNING_HOUR = 5;
const LATE_NIGHT_HOUR = 23;

const HEALTH_CONTEXTS = new Set(['sleep', 'water', 'food', 'exercise', 'medication']);

/** Cycle phases the dialogue engine tailors support pools for. */
export type CyclePhase = 'menstrual' | 'follicular' | 'fertile' | 'ovulation' | 'luteal';

const CYCLE_AWARE_CONTEXTS = new Set([
  'period_logged',
  'period_corrected',
  'period_approaching',
  'day_logged',
  'mood_logged',
]);

class DialogueEngine {
  private dialogues: Record<string, string[]> = { ...FALLBACK_DIALOGUES };
  private loaded = false;
  private memory: MemoryContext | null = null;
  private cyclePhaseSource: (() => CyclePhase | undefined) | null = null;

  /** Injects a reader for the current cycle phase (injected at app init, never a raw store read). */
  setCyclePhaseSource(source: (() => CyclePhase | undefined) | null): void {
    this.cyclePhaseSource = source;
  }

  async loadAssets(): Promise<void> {
    try {
      const info = await FileSystem.getInfoAsync(DIALOGUES_FILE);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(DIALOGUES_FILE);
        const parsed = JSON.parse(content) as Record<string, string[]>;
        this.dialogues = { ...parsed, ...FALLBACK_DIALOGUES };
        this.loaded = true;
      }
    } catch {
      this.loaded = false;
    }
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  /** Injects the latest on-device memory snapshot; null disables memory-aware picks. */
  setMemoryContext(memory: MemoryContext | null): void {
    this.memory = memory;
  }

  get(context: DialogueContext, moodContext?: string): string {
    if (this.memory) {
      const memoryKey = resolveMemoryDialogue(context, this.memory, moodContext);
      if (memoryKey) {
        const memoryPool = this.dialogues[memoryKey];
        if (memoryPool && memoryPool.length > 0) {
          return memoryPool[Math.floor(Math.random() * memoryPool.length)];
        }
      }
    }

    if (HEALTH_CONTEXTS.has(context)) {
      const healthKey = `health_${context}`;
      const pool = this.dialogues[healthKey];
      if (pool && pool.length > 0) {
        return pool[Math.floor(Math.random() * pool.length)];
      }
    }

    if (CYCLE_AWARE_CONTEXTS.has(context)) {
      const phase = this.cyclePhaseSource?.();
      if (phase) {
        const phasePool = this.dialogues[`cycle_phase_${phase}`];
        if (phasePool && phasePool.length > 0) {
          return phasePool[Math.floor(Math.random() * phasePool.length)];
        }
      }
    }

    const normalizedContext = this.resolveContext(context, moodContext);
    const pool = this.dialogues[normalizedContext];
    if (!pool || pool.length === 0) {
      return '\u{1F4AC}';
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getAll(context: DialogueContext): string[] {
    return this.dialogues[context] ?? [];
  }

  private resolveContext(context: DialogueContext, moodContext?: string): DialogueContext {
    if (moodContext && context === 'mood_logged') {
      const moodKey = `mood_${moodContext}`;
      if (this.dialogues[moodKey]) return moodKey;
    }

    if (!context) {
      const hour = new Date().getHours();
      if (hour >= LATE_NIGHT_HOUR || hour < MORNING_HOUR) return 'late_night';
      if (hour >= EVENING_HOUR) return 'evening';
      if (hour >= MORNING_HOUR) return 'morning';
      return 'encouragement';
    }
    return context;
  }

  getWelcomeBack(): string {
    return this.get('welcome_back');
  }

  getStreakMessage(_streakCount: number, _metricType: string): string {
    const pool = this.dialogues['health_streak'];
    if (pool && pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return "You're doing great! Keep it up!";
  }

  getMilestoneMessage(achievementName: string): string {
    const pool = this.dialogues['health_milestone'];
    if (pool && pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return `You earned: ${achievementName}!`;
  }
}

export const dialogueEngine = new DialogueEngine();
export type { DialogueContext };

/**
 * Pure memory → dialogue-pool resolver (luna2phase2 §3.1/§3.2). Returns a pool
 * key when the memory context warrants a memory-aware line, or null to fall
 * back to the static pools. Habit awareness requires >= 3 consistent samples.
 */
export function resolveMemoryDialogue(
  context: DialogueContext,
  memory: MemoryContext,
  moodContext?: string,
): string | null {
  const {
    habitAverages,
    frequentLogTypes,
    streaks,
    sleepAverageHour,
    daysUntilNextPeriod,
    moodHistory,
    moodTrend,
    daysSinceLastSeen,
  } = memory;

  switch (context) {
    case 'welcome_back':
      if (daysSinceLastSeen !== null && daysSinceLastSeen >= 2) {
        return 'memory_welcome_missed';
      }
      return null;

    case 'late_night':
      if (
        frequentLogTypes.includes('sleep') &&
        sleepAverageHour !== undefined &&
        sleepAverageHour >= 22
      ) {
        return 'memory_sleep_late';
      }
      return null;

    case 'water':
      if (habitAverages.water !== undefined && habitAverages.water >= 6) {
        return 'memory_water_hero';
      }
      return null;

    case 'exercise':
      if ((streaks.exercise ?? 0) >= 3) {
        return 'memory_streak';
      }
      return null;

    case 'medication':
      if ((streaks.medication ?? 0) >= 3) {
        return 'memory_medication_consistent';
      }
      return null;

    case 'period_approaching':
      if (
        daysUntilNextPeriod !== null &&
        daysUntilNextPeriod >= 0 &&
        daysUntilNextPeriod <= 3
      ) {
        return 'memory_period_due';
      }
      return null;

    case 'mood_logged':
      if (
        moodContext &&
        (moodContext === 'sad' || moodContext === 'anxious') &&
        moodHistory.length >= 3 &&
        moodTrend === 'declining'
      ) {
        return 'memory_mood_recall';
      }
      return null;

    default:
      return null;
  }
}
