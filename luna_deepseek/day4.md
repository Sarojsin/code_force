# Day 4 — Dialogue Engine + dialogues.json

## Goal
Build the rule-based dialogue engine that selects pre-written messages based on context (event type, mood, time of day). The dialogues JSON is **not** bundled in the app — it ships inside `luna_assets_v1.zip` and is loaded from the file system after the user downloads Luna.

---

## 4.1 Create `dialogues.json` (Packaged in the Downloadable Zip)

This file is the content of the downloadable asset. During development you can keep a copy at `src/assets/companion/dialogues.json` for easy editing, but at build time it gets packaged into `luna_assets_v1.zip` and served from your backend/CDN.

```json
{
  "morning": [
    "Good morning! 🌸 Ready for a brand new day?",
    "Rise and shine! I missed you! 🐾",
    "Another beautiful day ahead! Let's make it count.",
    "Good morning! How did you sleep?",
    "The sun is up and so are we! 💪"
  ],
  "evening": [
    "Good evening! How was your day? 🌙",
    "You made it through another day. I'm proud of you.",
    "Evening already? Time flies when you're taking care of yourself.",
    "How are you feeling after today?",
    "The stars are out. Time to relax. ✨"
  ],
  "journal_saved": [
    "I'll keep this memory safe for you. 🌸",
    "Thank you for sharing with me. Writing helps you grow.",
    "You are so brave for putting your thoughts into words.",
    "Every word you write is a step toward understanding yourself better.",
    "Your journal is a treasure. I'm honored to be part of it."
  ],
  "mood_happy": [
    "You seem happy today! Let's celebrate! 🎉",
    "I love seeing you smile! Your happiness is contagious!",
    "A happy day with you is the best kind of day! 😊",
    "You're radiating positive energy! ✨",
    "Keep that smile shining bright!"
  ],
  "mood_sad": [
    "I'm here for you. Always. 🐾",
    "Sending you a warm hug. Everything will be okay. 🤗",
    "It's okay to feel sad. Let's sit together for a moment.",
    "You don't have to be strong all the time. I'm here.",
    "Better days are coming. I promise. 🌈"
  ],
  "mood_anxious": [
    "Let's take a deep breath together. In... and out. 🌬️",
    "You're safe. I'm right here with you.",
    "Take a slow breath. One step at a time.",
    "Close your eyes and breathe with me for a moment.",
    "Anxiety is tough, but you're tougher. I believe in you."
  ],
  "mood_angry": [
    "It's okay to feel angry. Vent it out, I'm listening.",
    "Let's take a walk together. Sometimes movement helps.",
    "You have every right to feel this way. Let it pass.",
    "Deep breaths. You're stronger than this moment.",
    "I'm here to listen if you want to talk about it."
  ],
  "period_logged": [
    "You did it! Logging your period is self-care! 🎉",
    "I'm so proud of you for tracking this. Knowledge is power!",
    "Your body is incredible. Thank you for taking care of it.",
    "Logged! Now rest if you need to. Your body deserves rest.",
    "You're doing amazing! Every log helps you understand your cycle better."
  ],
  "period_approaching": [
    "Your next period is coming soon. I'm here for you. 🌸",
    "Heads up! Your period is on the way. Be gentle with yourself.",
    "Your cycle is preparing for a new phase. You've got this!",
    "Soon your period will arrive. Let's make sure you're ready.",
    "I'll be right here when it comes. You're never alone."
  ],
  "water_logged": [
    "Let's drink some water! Hydration is key! 💧",
    "I'm getting thirsty too! Cheers to hydration! 🥤",
    "Water is life! Great job keeping hydrated.",
    "Your cells are thanking you right now!",
    "Stay hydrated, stay healthy! You're doing great!"
  ],
  "exercise_completed": [
    "You did it! That's a win for your body! 💪",
    "Amazing effort! Every workout makes you stronger.",
    "You moved your body today. That's something to celebrate! 🎉",
    "Exercise is self-love in motion. Well done!",
    "Your future self will thank you for this!"
  ],
  "late_night": [
    "We both should sleep soon. Rest is important! 😴",
    "It's getting late. Let's rest and recharge together.",
    "Sweet dreams! I'll see you in the morning. 🌙",
    "Your body needs rest. Don't stay up too late!",
    "Sleep is the best medicine. Let's close our eyes."
  ],
  "welcome_back": [
    "Welcome back! I was waiting for you! 🌸",
    "I missed you! So glad to see you again! 🐾",
    "You're back! Let's catch up! How have you been?",
    "Every time you open the app, my day gets brighter!",
    "So happy to see you! Ready to take on the day?"
  ],
  "petted": [
    "Purr... that feels so nice! 🐱",
    "Pet me again please! Your touch is magical!",
    "Mew! I love your attention!",
    "That's my favorite spot! Right there!",
    "You know exactly how to make me happy! 🥰"
  ],
  "level_up": [
    "I grew stronger because of you! 🌟",
    "Level up! Our bond is getting stronger!",
    "Together we're unstoppable! Thank you! ✨",
    "New level unlocked! All thanks to your care!",
    "I'm evolving! Our friendship is magical!"
  ],
  "encouragement": [
    "You're stronger than you think. Never forget that.",
    "Every small step counts. You're making progress.",
    "You are enough, just as you are. 🌸",
    "The fact that you're trying is already a victory.",
    "You have survived everything life has thrown at you. Keep going."
  ]
}
```

---

## 4.2 Create `src/services/companion/DialogueEngine.ts`

The engine reads the JSON file from the **file system** (not a static import), since the file is downloaded post-install.

```typescript
/**
 * Rule-based dialogue engine.
 * Loads dialogues from the downloaded assets folder (Game DLC model).
 * No AI, no network calls — purely local.
 */

import * as FileSystem from 'expo-file-system';

const COMPANION_DIR = FileSystem.documentDirectory + 'companion/';
const DIALOGUES_FILE = COMPANION_DIR + 'dialogues.json';

// ── Fallback dialogues (tiny set bundled in code) ──
// Used only when assets haven't been downloaded yet.
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

class DialogueEngine {
  private dialogues: Record<string, string[]> = { ...FALLBACK_DIALOGUES };
  private loaded = false;

  /**
   * Load dialogues from the downloaded assets folder.
   * Must be called after asset download completes.
   */
  async loadAssets(): Promise<void> {
    try {
      const info = await FileSystem.getInfoAsync(DIALOGUES_FILE);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(DIALOGUES_FILE);
        const parsed = JSON.parse(content) as Record<string, string[]>;
        this.dialogues = { ...parsed, ...FALLBACK_DIALOGUES }; // fallbacks always win
        this.loaded = true;
      }
    } catch {
      // Keep using fallbacks if file is missing or corrupted
      this.loaded = false;
    }
  }

  /** Check if full dialogue assets are loaded */
  get isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get a random dialogue for the given context.
   */
  get(context: DialogueContext, moodContext?: string): string {
    const normalizedContext = this.resolveContext(context, moodContext);
    const pool = this.dialogues[normalizedContext];
    if (!pool || pool.length === 0) {
      return '💬';
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
    const hour = new Date().getHours();
    return this.get('welcome_back');
  }
}

export const dialogueEngine = new DialogueEngine();
export type { DialogueContext };
```

---

## 4.3 Asset Directory Structure

The downloaded `luna_assets_v1.zip` extracts to:
```
FileSystem.documentDirectory + 'companion/'
  ├── dialogues.json
  ├── spritesheet.png
  ├── spritesheet.json   (frame data: x, y, width, height per frame)
  └── sounds/
      ├── meow.mp3
      ├── purr.mp3
      └── celebrate.mp3
```

This structure is created by the asset downloader (Day 8).

---

## 4.4 Test the Dialogue Engine

**File:** `src/__tests__/DialogueEngine.test.ts`

```typescript
import { dialogueEngine } from '../services/companion/DialogueEngine';

describe('DialogueEngine', () => {
  it('returns a string for each dialogue context', () => {
    const contexts = [
      'morning', 'evening', 'journal_saved',
      'mood_happy', 'mood_sad', 'mood_anxious', 'mood_angry',
      'period_logged', 'period_approaching',
      'water_logged', 'exercise_completed',
      'late_night', 'welcome_back', 'petted', 'level_up', 'encouragement',
    ] as const;
    for (const ctx of contexts) {
      const msg = dialogueEngine.get(ctx);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it('returns different messages on multiple calls', () => {
    const messages = new Set<string>();
    for (let i = 0; i < 20; i++) {
      messages.add(dialogueEngine.get('encouragement'));
    }
    // With 5 messages in the pool, we should get at least 2 different ones
    expect(messages.size).toBeGreaterThan(1);
  });

  it('resolves mood_logged to mood-specific dialogues', () => {
    const happyMsg = dialogueEngine.get('mood_logged', 'happy');
    expect(happyMsg).toContain('happy') || expect(happyMsg).toContain('celebrate');
  });

  it('returns fallback for unknown context', () => {
    // Use a cast to test edge case — not ideal but pragmatic
    const msg = dialogueEngine.get('nonexistent_context' as any);
    expect(msg).toBeTruthy();
  });
});
```

---

## ✅ Day 4 Validation

- [ ] `dialogues.json` created with 16 context keys, 5 messages each (80 total)
- [ ] `src/services/companion/DialogueEngine.ts` created with `loadAssets()` method
- [ ] Engine reads from `FileSystem.documentDirectory + 'companion/dialogues.json'`
- [ ] Fallback dialogues bundled in code for pre-download state
- [ ] `get(context)` returns a random message from the pool
- [ ] `get('mood_logged', 'happy')` resolves to `mood_happy` dialogues
- [ ] `loadAssets()` called after asset download completes
- [ ] `isLoaded` property reflects whether full assets are available
- [ ] Unit tests pass
- [ ] App builds without errors
