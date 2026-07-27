# Phase 2 Day 1 — 200+ Quotes + DialogueEngine Health Contexts

## Goal
Expand `dialogues.json` from ~80 to 200+ entries, adding 7 new health categories (sleep, water, food, exercise, medication, streak, milestone). Update `DialogueEngine.ts` to resolve health-prefixed contexts.

---

## 1.1 Expand `dialogues.json` (inside `luna_assets_v1.zip`)

Add these new categories to the existing JSON. Each category needs 8-12 entries for variety.

**New categories to add:**

| Category | Theme | Example |
|----------|-------|---------|
| `health_sleep` | After logging sleep | "Sleep is your superpower! 😴" |
| `health_water` | After logging water | "Your cells are thanking you! 💧" |
| `health_food` | After logging a meal | "Nourishing your body! 🥗" |
| `health_exercise` | After logging exercise | "Your future self thanks you! 💪" |
| `health_medication` | After logging medication | "Taking care of yourself! 🌸" |
| `health_streak` | Achieving a streak | "You're on fire! Keep going! 🔥" |
| `health_milestone` | Unlocking an achievement | "You earned this! 🏆" |

```json
{
  "health_sleep": [
    "Sleep is your superpower! 😴",
    "A good night's sleep sets the tone for the day.",
    "Your body repairs itself while you rest. Well done!",
    "Sleep is self-care in its purest form.",
    "Rest well, warrior. Tomorrow is a new day. ✨",
    "Your sleep score is looking great!",
    "Consistent sleep = consistent you. Keep it up!",
    "Dream big — you earned that rest.",
    "Sleeping well is an act of self-love. 💕",
    "7-9 hours is the sweet spot. Nailed it!"
  ],
  "health_water": [
    "Your cells are thanking you! 💧",
    "Hydration is happiness. Keep drinking!",
    "Water is nature's elixir. Great choice!",
    "Every sip counts toward a healthier you.",
    "Glowing skin starts from within. Cheers! 🥤",
    "You're doing amazing — stay hydrated!",
    "Water helps reduce menstrual bloating. Keep going!",
    "Drinking water before meals helps digestion.",
    "Your kidneys love you for this.",
    "Hydration streak looking strong!"
  ],
  "health_food": [
    "Nourishing your body! 🥗",
    "You are what you eat — and you're amazing!",
    "Balanced meals, balanced life.",
    "Fueling your body with love and nutrients!",
    "Eating well is a form of self-respect.",
    "Your gut will thank you for this meal.",
    "Colorful plate = colorful health! 🍎🥦",
    "Mindful eating is the best eating.",
    "You're not just eating — you're thriving!",
    "Every healthy meal is a win. Celebrate it!"
  ],
  "health_exercise": [
    "Your future self thanks you! 💪",
    "Movement is medicine. Well done!",
    "You're stronger than you think!",
    "Exercise boosts mood and energy. Keep moving!",
    "Every minute of movement counts.",
    "Your heart is smiling right now! 🏃‍♀️",
    "Gentle movement is perfect for today.",
    "You moved your body — that's a victory!",
    "Exercise helps with period pain. Smart choice!",
    "Endorphins are flowing! Feel that glow? ✨"
  ],
  "health_medication": [
    "Taking care of yourself! 🌸",
    "Consistency is key. You're doing great!",
    "Your future self thanks you for being consistent.",
    "Medication is a tool, not a burden. You've got this!",
    "Being on top of your health is empowering.",
    "Well done for staying on schedule!",
    "Your body appreciates the routine.",
    "You're building healthy habits every day!",
    "Responsible and strong — that's you!",
    "Little wins add up to big health gains."
  ],
  "health_streak": [
    "You're on fire! Keep going! 🔥",
    "Streak alert! Look at you go!",
    "Consistency is your superpower. 🌟",
    "Day after day, you're building something beautiful.",
    "This streak is proof of your dedication!",
    "You're not just showing up — you're thriving!",
    "Streak mode: UNSTOPPABLE 🚀",
    "Every day counts. This streak proves it!",
    "You're creating habits that last a lifetime.",
    "Another day, another win! Keep that streak alive!"
  ],
  "health_milestone": [
    "You earned this! 🏆",
    "Milestone unlocked! You're incredible!",
    "This achievement is a reflection of your dedication.",
    "Look how far you've come! Congratulations! 🌟",
    "You set a goal and crushed it. Amazing!",
    "This badge is well-deserved. Wear it with pride!",
    "Another milestone on your health journey!",
    "You're leveling up in real life! 🎮",
    "Celebrate this win — you worked hard for it.",
    "Milestone reached! The journey continues!"
  ]
}
```

**Update the development copy** at `src/assets/companion/dialogues.json` (if you keep one for editing). The production version ships in `luna_assets_v1.zip`.

---

## 1.2 Update `DialogueEngine.ts` — Health Context Resolution

**File:** `src/services/companion/DialogueEngine.ts`

Add health context support to the `get()` method so that contexts like `'sleep'`, `'water'`, `'food'`, `'exercise'`, `'medication'` automatically resolve to `'health_sleep'`, `'health_water'`, etc.

```typescript
// Add inside the DialogueEngine class, before the existing context resolution:

private healthContexts = new Set(['sleep', 'water', 'food', 'exercise', 'medication']);

// Updated get() method:
get(context: string, moodContext?: string): string {
  // Health metric contexts resolve to health_ prefix
  if (this.healthContexts.has(context)) {
    const healthKey = `health_${context}`;
    const pool = this.dialogues[healthKey];
    if (pool && pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  // ── existing resolution logic follows ──
  // time-of-day check, mood check, direct context lookup, fallback
}
```

Also add a new method for streak/milestone dialogues:

```typescript
getStreakMessage(streakCount: number, metricType: string): string {
  const pool = this.dialogues['health_streak'];
  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return "You're doing great! Keep it up! 🔥";
}

getMilestoneMessage(achievementName: string): string {
  const pool = this.dialogues['health_milestone'];
  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return `You earned: ${achievementName}! 🏆`;
}
```

---

## 1.3 Update `eventBus.ts` — Add Health Event Types

**File:** `src/services/eventBus.ts`

Add these to the `EventMap` interface:

```typescript
water_logged: { userId: string; amount: number };
food_logged: { userId: string; mealType: string; notes?: string };
exercise_logged: { userId: string; type: string; duration: number };
medication_logged: { userId: string; name: string; taken: boolean };
```

---

## 1.4 Update `companionStore` XP/COIN Rewards

**File:** `src/stores/companionStore.ts`

Add reward values for the new health events:

```typescript
export const XP_REWARDS = {
  // ... existing entries ...
  water_logged: 3,
  food_logged: 5,
  exercise_completed: 8,
  medication_logged: 4,
  health_streak: 20,
  health_milestone: 50,
} as const;

export const COIN_REWARDS = {
  // ... existing entries ...
  water_logged: 1,
  food_logged: 2,
  exercise_completed: 2,
  medication_logged: 1,
  health_streak: 5,
  health_milestone: 10,
} as const;
```

---

## 1.5 Validation

- [ ] `dialogues.json` has 200+ entries across all categories (count them)
- [ ] `DialogueEngine.get('sleep')` returns a `health_sleep` quote
- [ ] `DialogueEngine.get('water')` returns a `health_water` quote
- [ ] `dialogueEngine.getStreakMessage(5, 'sleep')` returns a quote
- [ ] `dialogueEngine.getMilestoneMessage('Sleep Streak')` returns a quote
- [ ] EventMap has the 4 new health event types
- [ ] XP_REWARDS includes new health event entries
- [ ] `tsc --noEmit` passes with 0 new errors
