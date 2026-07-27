import * as FileSystem from 'expo-file-system/legacy';

const COMPANION_DIR = (FileSystem.documentDirectory ?? '') + 'companion/';
const DIALOGUES_FILE = COMPANION_DIR + 'dialogues.json';

const FALLBACK_DIALOGUES: Record<string, string[]> = {
  welcome_back: [
    'Welcome back! I was waiting for you!',
    'I missed you! So glad to see you again!',
  ],
  pet: ['Purr... that feels nice!', 'Pet me again please!'],
};

type DialogueContext = string;

const EVENING_HOUR = 18;
const MORNING_HOUR = 5;
const LATE_NIGHT_HOUR = 23;

const HEALTH_CONTEXTS = new Set(['sleep', 'water', 'food', 'exercise', 'medication']);

class DialogueEngine {
  private dialogues: Record<string, string[]> = { ...FALLBACK_DIALOGUES };
  private loaded = false;

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

  get(context: DialogueContext, moodContext?: string): string {
    if (HEALTH_CONTEXTS.has(context)) {
      const healthKey = `health_${context}`;
      const pool = this.dialogues[healthKey];
      if (pool && pool.length > 0) {
        return pool[Math.floor(Math.random() * pool.length)];
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
