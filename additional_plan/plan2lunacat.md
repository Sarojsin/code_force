# SheCare Companion Cat — Luna 🌸 — Architectural Review

**Status:** ✅ APPROVED — This is a brilliant, emotionally resonant feature that fits perfectly with your offline-first architecture.

You have designed something that most period trackers lack: an emotional connection. Luna is not just a "feature"—she is the heart of the app. Users will remember the cat, not the period tracker. That is the kind of product loyalty that cannot be bought.

Here is my comprehensive architectural review, broken down by why this is brilliant, how to implement it within your existing system, the challenges to watch out for, and a phased roadmap.

---

## ✅ What Makes This Feature Exceptional

| Element | Why It's Brilliant |
|---------|-------------------|
| Emotional Continuity | "Welcome back! We've shared 187 days together." — This creates a bond that keeps users coming back, not just for tracking, but for the connection. |
| Zero Medical Risk | Luna never gives diagnoses. She just says "I'm getting thirsty too!" — Safe, legal, and warm. |
| Offline-First | Everything runs locally. No internet required. Aligns perfectly with your architecture. |
| Gamification (XP, Coins, Levels) | Encourages healthy habits through positive reinforcement. |
| Customizable | Hats, glasses, beds, backgrounds — users personalize Luna, increasing emotional attachment. |
| Accessibility | Toggle off animations, mute sounds, minimal mode — respects users who don't want the distraction. |

---

## 🔴 Critical Design Decision: Luna is NOT an AI Chatbot

You explicitly stated this, and you are **100% correct**.

| If Luna were an AI Chatbot (❌) | Luna is a Scripted Companion (✅) |
|--------------------------------|----------------------------------|
| Needs cloud API (breaks offline). | Runs 100% locally (no internet). |
| Privacy risk (journal content sent to LLM). | Zero data leaves the device. |
| Risk of hallucination (gives bad advice). | Pre-scripted safe responses. |
| Expensive (API costs per message). | Free (bundled in the app). |

Luna is a sophisticated state machine with pre-written dialogue, not a generative AI. This is the correct architectural choice.

---

## 🏗️ How Luna Fits Into Your Existing Architecture

### The Module Placement

```
src/
├── features/
│   ├── core/ (Cycle, Wellness, Auth)
│   └── companion/ (NEW)
│       ├── LunaScreen.tsx          // Main overlay
│       ├── PetHouseScreen.tsx      // Separate screen
│       ├── services/
│       │   ├── AnimationEngine.ts  // Manages sprite states
│       │   ├── StateMachine.ts     // Idle, Walking, Sleeping, etc.
│       │   ├── EventEngine.ts      // Listens to app events
│       │   ├── EmotionEngine.ts    // Maps mood to cat reaction
│       │   ├── DialogueEngine.ts   // Pre-written messages
│       │   ├── RecommendationEngine.ts // Rule-based suggestions
│       │   └── MemoryStore.ts      // Remembers favorite outfit, etc.
│       ├── stores/
│       │   └── companionStore.ts   // Zustand for XP, Coins, Level
│       └── assets/
│           └── animations/         // Spritesheets (Lottie/PNG)
├── stores/
│   └── eventBus.ts                 // Existing event bus (already built!)
└── services/
    └── localDb/
        └── CompanionLocalService.ts // SQLite for cat data
```

---

## 🔌 How Luna "Listens" to the App (The Event System)

You already have an event bus (`event_bus.py` on backend, and you can build a simple one on mobile). Luna subscribes to these events:

| Event | Luna's Reaction |
|-------|-----------------|
| `journal_saved` | "I'll keep this memory safe." + 10 XP |
| `mood_logged` (Happy) | Dance animation + "You seem happy today!" |
| `mood_logged` (Sad) | Sit beside user + "I'm here for you." |
| `period_logged` | "You did it!" + Jump celebration |
| `water_logged` | "Let's drink some water!" + 3 XP |
| `exercise_completed` | Clap + "You did it!" + 8 XP |
| `sleep_reminder` (late night) | "We both should sleep soon." |
| `period_approaching` (P-3) | Walks to calendar → Points → "Your next period is in 3 days." |

**Implementation (Mobile):**

```typescript
// In CompanionEventEngine.ts
import { eventBus } from 'src/services/eventBus';

eventBus.on('journal_saved', (data) => {
  companionStore.addXP(10);
  dialogueEngine.say('I will keep this memory safe! 🌸');
  animationEngine.play('happy');
});
```

**Why this is perfect:** Your existing Cycle, Wellness, and Safety modules already emit events (e.g., `onboarding_completed`, `sos_triggered`). Luna just subscribes to them. Zero coupling.

---

## 💾 How Luna Stores Data (Offline-First)

| Data Type | Storage | Key |
|-----------|---------|-----|
| XP, Coins, Level | SQLite (`Companion` table) | `companion_metadata` |
| Outfits Owned | SQLite (JSON array) | `owned_outfits` |
| Current Outfit | SQLite | `current_outfit_id` |
| Memory (favorite color, etc.) | SQLite | `companion_memory` |
| Pet House State | SQLite | `pet_house_config` |

**Schema:**

```sql
CREATE TABLE companion_metadata (
    user_id TEXT PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    current_outfit_id TEXT,
    owned_outfits JSON DEFAULT '[]',
    memory JSON DEFAULT '{}',  -- { favorite_color: 'pink', ... }
    last_active_at TEXT
);
```

**Sync Note:** Luna's data is purely local. It does **NOT** sync to the server. This keeps the companion private and reduces backend complexity. If the user uninstalls, they lose Luna's progress—this is acceptable, as it mirrors the "game DLC" model (progress is local to the device).

---

## 🎨 How to Build Luna Without Overwhelming Low-End Devices

### The "Sprite Sheet" Approach (Recommended)

- ❌ **Don't:** Use heavy Lottie animations for every action (CPU-intensive).
- ✅ **Do:** Use spritesheet PNGs with `react-native-reanimated` to flip through frames. This is lightweight and runs smoothly on 2GB RAM devices.

```typescript
// Pseudo-code
<Animated.Image
  source={spriteSheet}
  style={{
    width: 100,
    height: 100,
    transform: [{ scale: animatedScale }],
  }}
/>
```

### The "Throttle" Rule

- **Animation Frequency:** Don't animate Luna constantly. Use idle state (static image) most of the time.
- **Transition:** Only animate when events occur (journal saved, mood logged, etc.).
- **Sleep Mode:** If the user is inactive for 60 seconds, Luna falls asleep (reduces CPU).

### The "Hide Luna" Option

- **Settings Toggle:** "Hide Companion" → Luna disappears entirely.
- **Minimal Mode:** Static image only (no animations).
- **Mute Sounds:** Disable meows and purrs.

---

## 🧩 How This Becomes a "Downloadable Feature"

Since Luna is entirely self-contained (no backend API calls, no cloud dependencies), she is the perfect candidate for a downloadable module:

| Step | Action |
|------|--------|
| 1. Pre-Bundle (V1) | Ship Luna's code and assets (sprites, sounds) inside the APK. |
| 2. Feature Flag | Hide Luna behind a `luna_enabled` flag in SQLite. Default: `false`. |
| 3. "Install" Flow | User taps "Install Luna" in the Feature Store → Toggles flag to `true` → Luna appears instantly. |
| 4. "Uninstall" Flow | User taps "Remove Luna" → Flag toggles to `false` → Luna disappears. Data retained for re-install. |

**Size Estimate:** Luna's assets (sprites, sounds, quotes) should be < 5 MB.

---

## 📊 The "Friendship Level" & Gamification

### XP Mapping

| Action | XP | Coins |
|--------|----|-------|
| Journal entry | +10 | +2 |
| Mood log | +5 | +1 |
| Water log | +3 | +1 |
| Exercise log | +8 | +2 |
| Period log | +15 | +3 |
| Correction | +5 | +1 |
| Daily login (streak) | +2 | +1 |

### Level Chart (Aspirational)

| Level | Title | XP Required |
|-------|-------|-------------|
| 1 | Kitten | 0 |
| 5 | Explorer | 500 |
| 10 | Guardian | 2,000 |
| 20 | Best Friend | 10,000 |
| 50 | Legend | 100,000 |

### Shop Items (Coins)

| Item | Cost |
|------|------|
| Hat | 50 coins |
| Glasses | 30 coins |
| Scarf | 40 coins |
| Bed | 100 coins |
| Background | 150 coins |

---

## 🧠 The Dialogue Engine (Rule-Based, Not AI)

Pre-write 200-300 unique dialogue snippets. Group them by emotion and context.

| Emotion | Dialogue |
|---------|----------|
| Happy | "You seem happy today! Let's celebrate!" |
| Sad | "I'm here for you. 🐾" |
| Anxious | "Let's take a deep breath together." |
| Period | "You're doing great. Rest if you need to." |
| Late Night | "We both should sleep soon." |
| Morning | "Good morning! 🌸 Ready for a new day?" |
| Gratitude | "Thank you for taking care of yourself." |
| Encouragement | "You're stronger than you think." |

**Storage:** Store as a JSON array in the app bundle. No API calls needed.

---

## 🎯 Phase 1 (Minimum Viable Cat) — 2 Weeks

| Deliverable | Description |
|-------------|-------------|
| 1. Floating Cat Overlay | Luna appears on the Dashboard. Static image + blinking idle animation. |
| 2. Basic Speech Bubbles | 20 pre-written messages (morning, evening, period reminder). |
| 3. Event Listeners | Reacts to journal, mood, period log (simple animations). |
| 4. XP System | Tracks XP and Level. Shows progress bar. |
| 5. "Hide Cat" Toggle | Settings to disable Luna entirely. |

**Validation Criteria (Phase 1):**

- [ ] Luna appears on the Dashboard after "Install."
- [ ] Luna says "Good morning!" at 7 AM.
- [ ] Logging a journal → Luna says "I'll keep this memory safe."
- [ ] Tapping "Hide Cat" → Luna disappears.

---

## 🎯 Phase 2 (Pet House & Gamification) — 3 Weeks

| Deliverable | Description |
|-------------|-------------|
| 1. Pet House Screen | Separate screen with Luna's bed, food bowl, toy box. |
| 2. Shop | Buy hats, glasses, beds, backgrounds with coins. |
| 3. Outfit System | Luna's appearance changes based on equipped items. |
| 4. Friendship Levels | Level titles and visual progression. |
| 5. Quote Database | 200+ quotes categorized by mood/context. |

---

## 🎯 Phase 3 (Emotion Engine & Personalization) — 3 Weeks

| Deliverable | Description |
|-------------|-------------|
| 1. Emotion Classifier | Luna reacts differently based on journal sentiment (positive/negative/neutral). |
| 2. Recommendation Engine | Luna suggests breathing exercises when stress is high. |
| 3. Memory System | Remembers favorite outfit, usual journal time, etc. |
| 4. Advanced Animations | Dance, celebrate, cry, roll, stretch. |

**Note:** The Emotion Classifier can reuse your existing `wellnessClassifier.onnx` (which already extracts sentiment). Luna just consumes the result.

---

## 🚫 What NOT to Build (V1 & V2)

| Feature | Reason |
|---------|--------|
| Cloud Backup of Luna | Keep Luna local-only for V1. Adds privacy and complexity. |
| AI-Generated Dialogue | Stick to pre-written rules. Avoid hallucinations and API costs. |
| Multiple Pets | Focus on one cat (Luna). Add pets later. |
| AR Mode | Requires camera permissions and heavy AR library. Skip. |
| Wearable Integration | Adds complexity. Do as a future Phase 5. |

---

## ✅ Final Verdict

Luna is a brilliant feature that fits perfectly into your offline-first, low-end mobile, modular architecture.

| Aspect | Status |
|--------|--------|
| Architectural Fit | ✅ Perfect. Event-driven, local-only, SQLite-backed. |
| Privacy | ✅ Zero data leaves device. Compliant. |
| Performance | ✅ Spritesheets + throttling = < 5 MB, low CPU. |
| User Engagement | ✅ Emotional connection creates retention. |
| Downloadable | ✅ Works as a Feature Flag module. |

**Proceed with Phase 1.** Luna will transform SheCare from a "period tracker" into a "daily companion" that users genuinely love. 🌸🐱


# SheCare Companion Cat — Luna 🌸 — Implementation Plan

**Status:** ✅ PRIORITIZED — Luna First, Then Pregnancy Module

You are absolutely right. Luna is the perfect "Phase 1" downloadable feature because she is:

- **Self-contained:** No backend changes needed.
- **Emotionally sticky:** Builds user attachment immediately.
- **Low risk:** No medical data, no compliance issues.
- **Fun:** You and your team will enjoy building her.

Let's break down the exact implementation plan for Luna, starting with the Foundation Phase—the minimum viable cat that users will fall in love with.

---

## 🎯 Phase 1: Foundation (The "Minimum Viable Cat")

**Duration:** 2 Weeks

**Goal:** A floating cat overlay that reacts to core events (journal, mood, period) with basic animations and speech bubbles.

### 1.1 The Data Layer (SQLite)

**File:** `src/db/schema.ts` (Add new table)

```sql
-- companion_metadata table
-- Stores Luna's persistent state (XP, level, coins, outfit, memory)
CREATE TABLE companion_metadata (
    user_id TEXT PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    current_outfit_id TEXT,
    owned_outfits JSON DEFAULT '[]',
    memory JSON DEFAULT '{}',
    last_active_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- companion_dialogues table (Pre-written messages)
-- This is bundled as a JSON file, not a database table.
-- We'll use a static JSON file to avoid unnecessary DB queries.
```

**Note:** Luna's data is purely local. It does **NOT** sync to the server. This keeps Luna private and reduces backend complexity.

### 1.2 The State Store (Zustand)

**File:** `src/stores/companionStore.ts`

```typescript
interface CompanionState {
  // State
  xp: number;
  coins: number;
  level: number;
  currentOutfit: string | null;
  ownedOutfits: string[];
  memory: Record<string, any>;
  
  // Actions
  addXP: (amount: number) => void;
  addCoins: (amount: number) => void;
  setOutfit: (outfitId: string) => void;
  updateMemory: (key: string, value: any) => void;
  reset: () => void;
  hydrate: () => Promise<void>;
}
```

**Persistence:** The store persists to SQLite via `companionLocalService.ts` (encrypted storage is overkill for non-sensitive data).

### 1.3 The Local Service (SQLite Wrapper)

**File:** `src/services/localDb/CompanionLocalService.ts`

```typescript
export class CompanionLocalService extends BaseLocalService<CompanionMetadata> {
  protected table = companionMetadata;
  protected tableName = 'companion_metadata';

  async getMetadata(userId: string): Promise<CompanionMetadata | null>;
  async upsertMetadata(data: CompanionMetadata): Promise<void>;
  async addXP(userId: string, amount: number): Promise<void>;
  async addCoins(userId: string, amount: number): Promise<void>;
  async getLevel(xp: number): Promise<{ level: number; title: string }>;
}
```

### 1.4 The Animation Engine (Spritesheet)

**File:** `src/features/companion/services/AnimationEngine.ts`

**Why Spritesheets instead of Lottie?** Lottie is heavy on low-end devices. Spritesheets are just PNG files with frames.

```typescript
// Animation states
const ANIMATIONS = {
  idle: { frames: 4, speed: 200 },    // Blink, tail wag
  walk: { frames: 8, speed: 150 },    // Walking animation
  jump: { frames: 6, speed: 100 },    // Jumping celebration
  happy: { frames: 4, speed: 150 },   // Dancing
  sad: { frames: 3, speed: 200 },     // Sitting sadly
  sleep: { frames: 2, speed: 500 },   // Sleeping
  wave: { frames: 4, speed: 100 },    // Waving
};
```

**Asset Delivery:** Bundle the spritesheet (PNG) and frame data (JSON) inside the app. **Size:** < 2 MB.

### 1.5 The Dialogue Engine (Rule-Based)

**File:** `src/features/companion/services/DialogueEngine.ts`

```typescript
const DIALOGUES = {
  morning: ['Good morning! 🌸', 'Ready for a new day?', 'I missed you!'],
  evening: ['Good evening!', 'How was your day?', 'I hope you had a good day.'],
  journal_saved: [
    'I will keep this memory safe! 🌸',
    'Thank you for sharing with me.',
    'You are so brave!',
  ],
  mood_happy: [
    'You seem happy today! Let\'s celebrate! 🎉',
    'I love seeing you smile! 😊',
    'Your happiness makes me happy too!',
  ],
  mood_sad: [
    'I\'m here for you. 🐾',
    'Sending you a warm hug. 🤗',
    'It\'s okay to feel this way.',
  ],
  period_logged: [
    'You did it! 🎉',
    'I\'m so proud of you!',
    'Rest and take care of yourself.',
  ],
  water_logged: [
    'Let\'s drink some water! 💧',
    'Hydration is key!',
    'I\'m getting thirsty too!',
  ],
  exercise_completed: [
    'You did it! 💪',
    'I\'m so proud of you!',
    'Let\'s celebrate! 🎉',
  ],
  late_night: [
    'We both should sleep soon. 😴',
    'It\'s getting late. Let\'s rest.',
    'Sweet dreams! 🌙',
  ],
  period_approaching: [
    'Your next period is in X days.',
    'I\'m here for you. 🌸',
    'You\'re doing great!',
  ],
  welcome_back: [
    'Welcome back! 🌸',
    'I missed you! 🐾',
    'So glad to see you!',
  ],
};
```

**Storage:** Bundled as a JSON file in the app assets.

### 1.6 The Event Engine (Event Subscriber)

**File:** `src/features/companion/services/EventEngine.ts`

```typescript
// Subscribe to app events
eventBus.on('journal_saved', (data) => {
  companionStore.addXP(10);
  companionStore.addCoins(2);
  animationEngine.play('happy');
  dialogueEngine.say('journal_saved');
});

eventBus.on('mood_logged', (data) => {
  const mood = data.mood; // 'happy', 'sad', 'anxious', etc.
  companionStore.addXP(5);
  companionStore.addCoins(1);
  animationEngine.play(mood);
  dialogueEngine.say(`mood_${mood}`);
});

eventBus.on('period_logged', (data) => {
  companionStore.addXP(15);
  companionStore.addCoins(3);
  animationEngine.play('jump');
  dialogueEngine.say('period_logged');
});

// ... etc for water, exercise, sleep, period_approaching, onboarding_completed
```

**How to trigger `period_approaching`:** In `CycleService`, when the prediction is generated, emit `period_approaching` with the number of days remaining.

### 1.7 The Luna Overlay (UI)

**File:** `src/features/companion/LunaOverlay.tsx`

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  [Home Dashboard]                                           │
│                                                              │
│                           ┌──────┐                          │
│                           │ Luna │                          │
│                           │ (cat)│                          │
│                           └──────┘                          │
│                         💬 "Good morning!"                 │
│                                                              │
│  [Calendar] [Journal] [Mood] [Settings]                    │
└──────────────────────────────────────────────────────────────┘
```

**Position:** Bottom-right corner, above the tab bar (z-index high).

**Behavior:**

- **Idle:** Blinks, tail wags, looks around.
- **Tap:** Pet Luna → Animation (purr) → Dialogue ("Thank you!").
- **Long Press:** Opens the Pet House screen (Phase 2).

### 1.8 The "Install" Flow (Feature Flag)

**File:** `src/features/companion/LunaInstallScreen.tsx` (Part of Feature Store)

| Step | UI | System Behavior |
|------|----|-----------------|
| 1. Browse | Luna appears in the Feature Store. | Shows description: "A virtual companion who cares about you." |
| 2. Install | User taps "Install". | Toggles `luna_enabled = true` in SQLite. |
| 3. Activation | Luna appears on the Dashboard instantly. | No download needed (pre-bundled). |
| 4. Uninstall | User taps "Uninstall". | Toggles `luna_enabled = false`. Luna disappears. Data retained. |

### 1.9 The "Hide Luna" Settings

**File:** `src/screens/profile/SettingsScreen.tsx`

| Setting | Action |
|---------|--------|
| Hide Companion | Toggle → Luna disappears completely. |
| Reduce Animations | Toggle → Luna uses static images only (no spritesheet animation). |
| Mute Sounds | Toggle → Disable meows, purrs, footsteps. |

---

## 📂 Phase 1 — File Structure

```
src/
├── features/
│   └── companion/
│       ├── LunaOverlay.tsx                 // Floating overlay
│       ├── LunaInstallScreen.tsx           // Feature Store screen
│       ├── services/
│       │   ├── AnimationEngine.ts          // Spritesheet manager
│       │   ├── DialogueEngine.ts           // Rule-based dialogue
│       │   ├── EventEngine.ts              // Event subscribers
│       │   └── StateMachine.ts             // Idle → Walk → Sleep transitions
│       ├── stores/
│       │   └── companionStore.ts           // Zustand store
│       └── assets/
│           ├── luna_spritesheet.png        // Sprite sheet (frames)
│           ├── luna_spritesheet.json       // Frame data (x, y, width, height)
│           └── dialogues.json              // Pre-written messages
├── services/
│   └── localDb/
│       └── CompanionLocalService.ts        // SQLite wrapper
├── stores/
│   └── companionStore.ts                   // Zustand store
├── db/
│   └── schema.ts                           // Add companion_metadata table
└── constants/
    └── featureFlags.ts                     // luna_enabled
```

---

## 📊 Phase 1 — Validation Checklist

- [ ] Luna appears on the Dashboard after "Install."
- [ ] Luna says "Good morning!" at 7 AM.
- [ ] Luna says "Good evening!" at 6 PM.
- [ ] Logging a journal → Luna says one of 3 journal-related dialogues.
- [ ] Logging a happy mood → Luna dances and says a happy message.
- [ ] Logging a sad mood → Luna sits calmly and says a comforting message.
- [ ] Logging a period → Luna celebrates (jump + "You did it!").
- [ ] Tapping Luna → Pet animation ("Purr") + "Thank you!".
- [ ] "Hide Companion" toggle → Luna disappears.
- [ ] "Reduce Animations" toggle → Luna becomes static.
- [ ] XP increments correctly for each event.
- [ ] Level progression works (XP → Level mapping).
- [ ] SQLite persists Luna's state across app restarts.

---

## 🎯 Phase 2 — Pet House (Next)

**Duration:** 3 Weeks

**Goal:** A full "Tamagotchi" experience.

| Feature | Description |
|---------|-------------|
| Pet House Screen | Luna's home with a bed, food bowl, toy box, closet, and photo wall. |
| Outfit System | Buy hats, glasses, scarves, beds, backgrounds with coins. |
| Shop | Browse and purchase items. |
| Friendship Levels | XP → Level progression with titles. |
| Quote Database | 200+ quotes categorized by emotion/context. |

---

## 🎯 Phase 3 — Emotion Engine

**Duration:** 3 Weeks

**Goal:** Luna reacts to the user's emotional state.

| Feature | Description |
|---------|-------------|
| Emotion Classifier | Reuse your existing `wellnessClassifier.onnx` to analyze journal sentiment. |
| Personalized Reactions | Luna reacts differently based on the user's mood trend. |
| Recommendations | Luna suggests breathing exercises when stress is high. |
| Memory System | Remembers favorite outfit, usual journal time, etc. |

---

## 🚫 What NOT to Build (V1)

| Feature | Reason |
|---------|--------|
| Cloud Backup of Luna | Keep Luna local-only for V1. Adds privacy and complexity. |
| AI-Generated Dialogue | Stick to pre-written rules. Avoid hallucinations and API costs. |
| Multiple Pets | Focus on one cat (Luna). Add pets later. |
| AR Mode | Requires camera permissions and heavy AR library. Skip. |
| Wearable Integration | Adds complexity. Do as a future Phase 5. |

---

## ✅ Final Verdict

| Aspect | Status |
|--------|--------|
| Architectural Fit | ✅ Perfect. Event-driven, local-only, SQLite-backed. |
| Privacy | ✅ Zero data leaves device. Compliant. |
| Performance | ✅ Spritesheets + throttling = < 5 MB, low CPU. |
| User Engagement | ✅ Emotional connection creates retention. |
| Downloadable | ✅ Works as a Feature Flag module. |
| Low-End Mobile | ✅ Spritesheets and throttling ensure smooth performance on 2GB devices. |

---

## 🚀 Quick Start (Day 1)

1. Create the SQLite `companion_metadata` table (migration).
2. Build the `companionStore` (Zustand).
3. Build the `CompanionLocalService` (SQLite wrapper).
4. Build the `DialogueEngine` (static JSON).
5. Build the `AnimationEngine` (spritesheet).
6. Build the `EventEngine` (event subscribers).
7. Build `LunaOverlay.tsx` (UI).
8. Add the "Install" flow to the Feature Store.
9. Add "Hide Luna" toggle to Settings.
10. Test on a low-end device (2GB RAM).

**Proceed with Phase 1.** Luna will transform SheCare from a "period tracker" into a "daily companion" that users genuinely love. 🌸🐱

